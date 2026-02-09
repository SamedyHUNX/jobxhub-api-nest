import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { SignInDto, SignUpDto } from './dto/auth.dto';
import { and, eq, gt } from 'drizzle-orm';
import { UserTable } from '@/drizzle/schema';
import { ConfigService } from '@/common/services/config.service';
import * as Sentry from '@sentry/nestjs';
import { UserCacheService } from '@/cache/services/user-cache.service';
import { RateLimitCacheService } from '@/cache/services/rate-limit-cache.service';
import { InngestHealthService } from '@/inngest/services/inngest-health.service';
import { DrizzleHealthService } from '@/drizzle/services/drizzle-health.service';
import { HashingService } from '@/common/services/hashing.service';
import { User } from '@/types';
import { TokenService } from '@/common/services/token.service';
import { SignUpService } from './services/sign-up.service';
import { SignInService } from './services/sign-in.service';
import { VerifyEmailService } from './services/verify-email.service';
import { ForgotPasswordService } from './services/forgot-password.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private userCacheService: UserCacheService,
    private hashingService: HashingService,
    private rateLimitCacheService: RateLimitCacheService,
    private dbHealth: DrizzleHealthService,
    private tokenService: TokenService,
    private signUpService: SignUpService,
    private signInService: SignInService,
    private verifyEmailService: VerifyEmailService,
    private forgotPasswordService: ForgotPasswordService
  ) { }


  private get db() {
    return this.dbHealth.getDb();
  }


  private get userCache() {
    return this.userCacheService;
  }

  private async getCachedUserById(userId: string) {
    return await this.userCache.getUserById(userId);
  }

  private async cacheUser(user: any) {
    await this.userCache.setUser(user);
  }

  private async clearCachedUser(user: any) {
    await this.userCache.clearUser(user);
  }

  // Helper method to invalidate user cache
  private async invalidateUserCache(email: string, userId: string) {
    await this.userCache.invalidateUser(email, userId);
  }

  // Invalidate all sessions (force re-login on all devices)
  private async invalidateAllUserSessions(userId: string) {
    await this.userCache.invalidateAllSessions(userId);
  }

  ////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////

  async signUp(
    data: SignUpDto,
    imageFile: Express.Multer.File,
    acceptLanguage: string,
  ) {
    return await this.signUpService.signUp(data, imageFile, acceptLanguage);
  }

  ////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////

  async verifyEmail(token: string) {
    return await this.verifyEmailService.verifyEmail(token)
  }

  ////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////

  // Sign In
  async signIn(data: SignInDto, ipAddress: string, user: User) {
    return await this.signInService.signIn(data, ipAddress, user);
  }

  ////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////

  validateUser = async (payload: any) => {
    if (!payload) {
      throw new BadRequestException('Invalid payload');
    }

    // Try to get user from cache first
    const cachedUser = await this.getCachedUserById(payload.sub);

    if (cachedUser) {
      // Verify token version from cache
      if (payload.tokenVersion !== cachedUser.tokenVersion) {
        // Token version mismatch - clear cache and reject
        await this.clearCachedUser(cachedUser);
        this.logger.error(
          `Token version mismatch for user ID ${cachedUser.id}. Token invalidated.`,
        );
        throw new UnauthorizedException(
          'Token has been invalidated. Please sign in again.',
        );
      }

      return cachedUser;
    }

    // Cache miss - fetch from database
    const [user] = await this.db
      .select()
      .from(UserTable)
      .where(eq(UserTable.id, payload.sub))
      .limit(1);

    if (!user) {
      this.logger.error(
        `User with ID ${payload.sub} not found during validation`,
      );
      throw new UnauthorizedException('User not found');
    }

    // Check if tokenVersion matches
    if (payload.tokenVersion !== user.tokenVersion) {
      this.logger.error(
        `Token version mismatch for user ID ${user.id}. Token invalidated.`,
      );
      throw new UnauthorizedException(
        'Token has been invalidated. Please sign in again.',
      );
    }

    // Cache the user for future requests
    await this.cacheUser(user);

    return user;
  };

  ////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////

  forgotPassword = async (
    email: string,
    acceptLanguage: string,
    ipAddress: string,
  ) => {
    return await this.forgotPasswordService.forgotPassword(email, acceptLanguage, ipAddress)
  };

  ////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////

  resetPassword = async (
    token: string,
    newPassword: string,
    confirmNewPassword: string,
  ) => {
    if (newPassword !== confirmNewPassword) {
      this.logger.error(`User provided non-matching passwords`);
      throw new BadRequestException('Passwords must match');
    }

    // Hash the token from URL to compare with stored hash
    const hashedToken = this.tokenService.createHash(token);

    // Find user by reset token and check expiration
    const [user] = await this.db
      .select()
      .from(UserTable)
      .where(
        and(
          eq(UserTable.resetPasswordToken, hashedToken),
          gt(UserTable.resetPasswordExpires, new Date()),
        ),
      )
      .limit(1);

    if (!user) {
      this.logger.error('Invalid or expired password reset token used');
      throw new UnauthorizedException('Invalid or expired verification token');
    }

    // Hash new password
    const hashedPassword = await this.hashingService.hash(newPassword);

    // Update user's password and clear reset token fields
    await this.db
      .update(UserTable)
      .set({
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        tokenVersion: user.tokenVersion + 1,
      })
      .where(eq(UserTable.id, user.id));

    // Invalidate all cached user data
    await this.invalidateUserCache(user.email, user.id);

    // Invalidate all active sessions for this user
    await this.invalidateAllUserSessions(user.id);

    this.logger.log(`Password successfully reset for user ID: ${user.id}`);
    return true
  };

  async signOut(userId: string) {
    try {
      // 1. Get user data to clear cache properly
      const [user] = await this.db
        .select({
          id: UserTable.id,
          email: UserTable.email,
          tokenVersion: UserTable.tokenVersion,
        })
        .from(UserTable)
        .where(eq(UserTable.id, userId))
        .limit(1);

      if (!user) {
        this.logger.warn(`Sign out attempted for non-existent user: ${userId}`);
        return true
      }

      // 2. Increment token version to invalidate all existing tokens
      await this.db
        .update(UserTable)
        .set({
          tokenVersion: user.tokenVersion + 1,
        })
        .where(eq(UserTable.id, userId));

      // 3. Clear user cache
      await this.invalidateUserCache(user.email, user.id);

      // 4. Invalidate all sessions
      await this.invalidateAllUserSessions(user.id);

      // 5. Log the sign-out event
      this.logger.log(
        `User ${user.email} (ID: ${userId}) signed out successfully`,
      );

      return true
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          operation: 'sign_out',
        },
        extra: {
          userId,
        },
      });

      this.logger.error(`Sign out error for user ${userId}: ${error?.message}`);

      // Still return success
      return true
    }
  }
}
