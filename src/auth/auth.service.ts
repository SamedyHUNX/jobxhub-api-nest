import { DrizzleService } from '@/drizzle/drizzle.service';
import { S3Service } from '@/s3/s3.service';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SignInDto, SignUpDto } from './dtos/auth.dto';
import { and, eq, gt, or } from 'drizzle-orm';
import { capitalizeString, hashPassword } from '@/utils/helpers';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { UserTable } from '@/drizzle/schema';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InngestClientService } from '@/inngest/inngest.service';
import { ConfigService } from '@/config/config.service';
import * as Sentry from '@sentry/nestjs';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private jwtService: JwtService,
    private dbService: DrizzleService,
    private s3Service: S3Service,
    private inngestService: InngestClientService,
    private configService: ConfigService,
  ) {}

  private get redisServer() {
    if (!this.cacheManager) {
      const message = `Redis server is down at ${this.getTimestamp()}`;
      this.logger.error(message);
      Sentry.captureException(new Error(message));
      throw new InternalServerErrorException('Cache service unavailable');
    }
    return this.cacheManager;
  }

  private get inngest() {
    if (!this.inngestService || !this.inngestService.inngest) {
      const message = `Inngest client is down at ${this.getTimestamp()}`;
      this.logger.error(message);
      Sentry.captureException(new Error(message));
      throw new InternalServerErrorException('Event service unavailable');
    }
    return this.inngestService.inngest;
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private get dbServer() {
    if (!this.dbService.db) {
      const message = `Database connection not established at ${this.getTimestamp()}`;
      this.logger.error(message);
      Sentry.captureException(new Error(message));
      throw new InternalServerErrorException('Database unavailable');
    }
    return this.dbService.db;
  }

  private get s3Server() {
    if (!this.s3Service) {
      const message = `S3 service is down at ${this.getTimestamp()}`;
      this.logger.error(message);
      Sentry.captureException(new Error(message));
      throw new InternalServerErrorException('Storage service unavailable');
    }
    return this.s3Service;
  }

  private generateToken(payload: any) {
    return this.jwtService.sign(payload);
  }

  private async generateAndHashToken(expireMinutes: number) {
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + expireMinutes * 60 * 1000);
    return { token, hashedToken, expiresAt };
  }

  private async getCachedUser(email: string) {
    return await this.cacheManager.get<any>(`user:email:${email}`);
  }

  private async getCachedUserById(userId: string) {
    return await this.cacheManager.get<any>(`user:id:${userId}`);
  }

  private async cacheUser(user: any) {
    const ttl = 15 * 60 * 1000; // 15 minutes
    // Cache manager automatically stringifies
    await this.cacheManager.set(`user:email:${user.email}`, user, ttl);
    await this.cacheManager.set(`user:id:${user.id}`, user, ttl);
  }

  private async clearCachedUser(user: any) {
    await this.cacheManager.del(`user:email:${user.email}`);
    await this.cacheManager.del(`user:id:${user.id}`);
  }

  // Helper method to invalidate user cache
  private async invalidateUserCache(email: string, userId: string) {
    // Delete cache by email
    await this.redisServer.del(`user:email:${email}`);

    // Delete cache by user ID
    await this.redisServer.del(`user:id:${userId}`);

    this.logger.log(`Cache invalidated for user: ${email}`);
  }

  // Invalidate all sessions (force re-login on all devices)
  private async invalidateAllUserSessions(userId: string) {
    // Delete main session cache
    await this.redisServer.del(`session:${userId}`);

    // For pattern-based deletion, you need the raw Redis client
    // Option 1: If using cache-manager with Redis store
    const store = this.redisServer.stores as any;
    if (store && store.getClient) {
      const redisClient = store.getClient();
      const sessionKeys = await redisClient.keys(`session:${userId}:*`);
      if (sessionKeys.length > 0) {
        await Promise.all(
          sessionKeys.map((key: string) => this.redisServer.del(key)),
        );
      }
    }

    this.logger.log(`All sessions invalidated for user ID: ${userId}`);
  }

  private addConstantTimeDelay = async (startTime: number) => {
    const TARGET_RESPONSE_TIME = 600;
    const JITTER = 100;

    const elapsed = Date.now() - startTime;
    const delay = Math.max(
      0,
      TARGET_RESPONSE_TIME - elapsed + Math.random() * JITTER,
    );

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  };

  ////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////

  async signUp(
    data: SignUpDto,
    imageFile: Express.Multer.File,
    acceptLanguage: string,
  ) {
    const {
      username,
      password,
      email,
      firstName,
      lastName,
      dateOfBirth,
      phoneNumber,
    } = data;

    // Validate required fields
    if (
      !username ||
      !password ||
      !email ||
      !firstName ||
      !lastName ||
      !dateOfBirth ||
      !phoneNumber
    ) {
      throw new BadRequestException('All fields are required');
    }

    if (!imageFile) {
      throw new BadRequestException('Profile image is required');
    }

    // Check if email or username already exists
    const existingUser = await this.dbServer
      .select()
      .from(UserTable)
      .where(or(eq(UserTable.email, email), eq(UserTable.username, username)))
      .limit(1);

    if (existingUser.length > 0) {
      if (existingUser[0].email === email) {
        throw new ConflictException('Email already exists');
      }
      if (existingUser[0].username === username) {
        throw new ConflictException('Username already taken');
      }
    }

    // Sanitize filename
    const sanitizedName = imageFile.originalname.replace(
      /[^a-zA-Z0-9._-]/g,
      '_',
    );
    const imageKey = `users/avatars/${Date.now()}-${sanitizedName}`;

    await this.s3Server.uploadFile(imageFile, imageKey);

    // Get S3 URL
    const storageProvider = this.configService.storageProvider;
    const publicDomain =
      storageProvider === 'r2'
        ? this.configService.r2PublicDomain
        : this.configService.awsS3PublicDomain;

    if (!publicDomain) {
      throw new InternalServerErrorException('Storage configuration error');
    }

    const imageUrl = `${publicDomain}/${imageKey}`;

    try {
      const hashedPassword = await hashPassword(password);
      const capitalizedFirstName = capitalizeString(firstName);
      const capitalizedLastName = capitalizeString(lastName);

      const {
        token: verificationToken,
        hashedToken: hashedVerificationToken,
        expiresAt: verificationExpires,
      } = await this.generateAndHashToken(60 * 24);

      const frontendUrl = this.configService.publicUrl;
      const locale = acceptLanguage || 'en';

      if (!frontendUrl) {
        throw new InternalServerErrorException(
          'Application configuration error',
        );
      }

      const verificationUrl = `${frontendUrl}/${locale}/verify-email?token=${verificationToken}`;

      let user;

      try {
        [user] = await this.dbServer
          .insert(UserTable)
          .values({
            username,
            email,
            firstName: capitalizedFirstName,
            lastName: capitalizedLastName,
            dateOfBirth: new Date(dateOfBirth),
            password: hashedPassword,
            phoneNumber,
            imageUrl,
            userRole: 'USER',
            verificationToken: hashedVerificationToken,
            verificationExpires: verificationExpires,
          })
          .returning();
      } catch (dbError: any) {
        await this.s3Server.deleteFile(imageKey);

        // Handle unique constraint violation
        if (dbError.code === '23505') {
          // PostgreSQL unique violation
          if (dbError.constraint?.includes('email')) {
            throw new ConflictException('Email already exists');
          }
          if (dbError.constraint?.includes('username')) {
            throw new ConflictException('Username already taken');
          }
        }
        throw dbError;
      }

      try {
        await this.inngest.send({
          name: 'jobxhub/user.created',
          data: {
            userId: user.id,
            email: user.email,
            name: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            imageUrl: user.imageUrl,
            verificationUrl,
            acceptLanguage: locale,
          },
        });
      } catch (inngestError: any) {
        // Rollback: Delete the user we just created
        await this.dbServer.delete(UserTable).where(eq(UserTable.id, user.id));

        // Delete the uploaded image
        await this.s3Server.deleteFile(imageKey);

        Sentry.captureException(inngestError, {
          extra: {
            userId: user.id,
            email: user.email,
            context: 'signup_inngest_failed',
          },
        });

        this.logger.error(
          `Failed to emit user.created event: ${inngestError?.message ?? inngestError}`,
        );
        throw new InternalServerErrorException(
          'Failed to complete signup. Please try again',
        );
      }

      return {
        message: 'User signed up successfully. Please verify your email.',
      };
    } catch (error) {
      // Cleanup orphaned file
      this.logger.warn(
        `Database insertion failed. Deleting orphaned file: ${imageKey}`,
      );
      await this.s3Server
        .deleteFile(imageKey)
        .catch((e) =>
          this.logger.error(`Failed to delete ${imageKey}: ${e.message}`),
        );
      throw error;
    }
  }

  ////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////

  async verifyEmail(token: string) {
    // Validate token format before processing
    if (!token) {
      throw new BadRequestException('Invalid token');
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const [user] = await this.dbServer
      .select()
      .from(UserTable)
      .where(
        and(
          eq(UserTable.verificationToken, hashedToken),
          gt(UserTable.verificationExpires, new Date()),
        ),
      )
      .limit(1);

    if (!user) {
      // Log failed verification attempts for security monitoring
      this.logger.warn(
        `Failed email verification attempt with token: ${token.substring(0, 8)}...`,
      );

      // Check if it's an expired token (user exists but token expired)
      const [expiredUser] = await this.dbServer
        .select()
        .from(UserTable)
        .where(eq(UserTable.verificationToken, hashedToken))
        .limit(1);

      if (expiredUser) {
        // Token exists but expired - option to resend
        throw new UnauthorizedException(
          'Verification token has expired. Please request a new verification email',
        );
      }

      throw new UnauthorizedException('Invalid or expired verification token');
    }

    // Check if already verified (prevent replay attacks)
    if (user.isVerified) {
      this.logger.warn(
        `Attempt to verify already verified email: ${user.email}`,
      );
      return {
        message: 'Email already verified',
      };
    }

    try {
      await this.dbServer
        .update(UserTable)
        .set({
          isVerified: true,
          verificationToken: null,
          verificationExpires: null,
        })
        .where(eq(UserTable.id, user.id));

      this.logger.log(`Email successfully verified for user ID: ${user.id}`);

      // Send welcome email or trigger onboarding
      try {
        await this.inngest.send({
          name: 'jobxhub/user.verified',
          data: {
            userId: user.id,
            email: user.email,
          },
        });
      } catch (inngestError) {
        // Don't fail verification if event fails, just log it
        Sentry.captureException(inngestError, {
          extra: {
            userId: user.id,
            email: user.email,
            context: 'email_verification_event_failed',
          },
        });
        this.logger.error(
          `Failed to emit user.verified event: ${inngestError?.message}`,
        );
      }

      return {
        message: 'Email verified successfully',
      };
    } catch (error) {
      Sentry.captureException(error, {
        extra: {
          userId: user.id,
          email: user.email,
          context: 'email_verification_update_failed',
        },
      });
      this.logger.error(
        `Failed to update verification status: ${error?.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to verify email. Please try again',
      );
    }
  }

  ////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////

  // Sign In
  async signIn(data: SignInDto, ipAddress: string) {
    const { email, password } = data;
    const startTime = Date.now();

    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    try {
      if (this.configService.isProduction) {
        // 1. Check IP-based rate limiting (global protection)
        await this.checkIpRateLimit(ipAddress);

        // 2. Check email-based rate limiting (account protection)
        await this.checkEmailRateLimit(email);
      }

      // 3. Check for account lockout
      const isLocked = await this.isAccountLocked(email);
      if (isLocked) {
        await this.addConstantTimeDelay(startTime);
        throw new UnauthorizedException(
          'Account temporarily locked due to multiple failed login attempts. Please try again later or reset your password.',
        );
      }

      const cachedUser = await this.getCachedUser(email);

      let user;
      let passwordHash: string;

      if (cachedUser) {
        user = cachedUser;

        const [dbStatus] = await this.dbServer
          .select({
            isBanned: UserTable.isBanned,
            isDisabled: UserTable.isDisabled,
            isVerified: UserTable.isVerified,
            tokenVersion: UserTable.tokenVersion,
            password: UserTable.password,
          })
          .from(UserTable)
          .where(eq(UserTable.email, email))
          .limit(1);

        if (!dbStatus) {
          await this.handleFailedLogin(email, ipAddress, 'user_not_found');
          await this.addConstantTimeDelay(startTime);
          throw new UnauthorizedException('Invalid credentials');
        }

        if (dbStatus.isBanned) {
          await this.addConstantTimeDelay(startTime);
          throw new UnauthorizedException('Account has been banned');
        }

        if (dbStatus.isDisabled) {
          await this.addConstantTimeDelay(startTime);
          throw new UnauthorizedException('Account has been disabled');
        }

        if (!dbStatus.isVerified) {
          await this.addConstantTimeDelay(startTime);
          throw new UnauthorizedException(
            'Account is not verified. Please check your inbox to verify',
          );
        }

        const { password: dbPassword, ...status } = dbStatus;
        passwordHash = dbPassword;
        user = { ...user, ...status };

        await this.cacheUser(user);
      } else {
        const [dbUser] = await this.dbServer
          .select()
          .from(UserTable)
          .where(eq(UserTable.email, email))
          .limit(1);

        if (!dbUser) {
          await this.handleFailedLogin(email, ipAddress, 'user_not_found');
          await this.addConstantTimeDelay(startTime);
          throw new UnauthorizedException('Invalid credentials');
        }

        if (dbUser.isBanned) {
          await this.addConstantTimeDelay(startTime);
          throw new UnauthorizedException('Account has been banned');
        }

        if (dbUser.isDisabled) {
          await this.addConstantTimeDelay(startTime);
          throw new UnauthorizedException('Account has been disabled');
        }

        if (!dbUser.isVerified) {
          await this.addConstantTimeDelay(startTime);
          throw new UnauthorizedException(
            'Account is not verified. Please check your inbox to verify',
          );
        }

        passwordHash = dbUser.password;
        user = dbUser;

        await this.cacheUser(user);
      }

      const isPasswordValid = await bcrypt.compare(password, passwordHash);

      if (!isPasswordValid) {
        await this.handleFailedLogin(email, ipAddress, 'invalid_password');
        await this.addConstantTimeDelay(startTime);
        throw new UnauthorizedException('Invalid credentials');
      }

      // Successful login - clear failed attempts
      await this.clearFailedAttempts(email, ipAddress);

      const payload = {
        email: user.email,
        sub: user.id,
        tokenVersion: user.tokenVersion,
      };

      const token = this.generateToken(payload);

      // Log successful login
      this.logger.log(`Successful login for user: ${email}`);

      await this.addConstantTimeDelay(startTime);

      return {
        token,
      };
    } catch (error) {
      // Capture security-related errors in Sentry
      if (error instanceof UnauthorizedException) {
        Sentry.captureMessage('Failed login attempt', {
          level: 'warning',
          tags: {
            operation: 'sign_in',
            error_type: error.message,
          },
          extra: {
            email,
            ipAddress,
          },
        });
      } else {
        Sentry.captureException(error, {
          tags: {
            operation: 'sign_in',
          },
          extra: {
            email,
            ipAddress,
          },
        });
      }

      throw error;
    }
  }

  /**
   * Check IP-based rate limiting
   * Prevents distributed brute force attacks
   */
  private async checkIpRateLimit(ipAddress: string): Promise<void> {
    const ipRateLimitKey = `login_ip:${ipAddress}`;
    const ipAttempts =
      (await this.cacheManager.get<number>(ipRateLimitKey)) || 0;

    // Allow 10 attempts per IP per hour
    if (ipAttempts >= 10) {
      this.logger.warn(`IP rate limit exceeded: ${ipAddress}`);

      Sentry.captureMessage('IP rate limit exceeded on login', {
        level: 'warning',
        tags: {
          operation: 'sign_in',
          rate_limit_type: 'ip',
        },
        extra: {
          ipAddress,
          attempts: ipAttempts,
        },
      });

      throw new HttpException(
        'Too many login attempts from this IP address. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Increment counter with 1-hour TTL
    await this.cacheManager.set(ipRateLimitKey, ipAttempts + 1, 3600 * 1000);
  }

  /**
   * Check email-based rate limiting
   * Prevents targeted attacks on specific accounts
   */
  private async checkEmailRateLimit(email: string): Promise<void> {
    const emailRateLimitKey = `login_email:${email}`;
    const emailAttempts =
      (await this.cacheManager.get<number>(emailRateLimitKey)) || 0;

    // Allow 5 attempts per email per 15 minutes
    if (emailAttempts >= 5) {
      this.logger.warn(`Email rate limit exceeded: ${email}`);

      Sentry.captureMessage('Email rate limit exceeded on login', {
        level: 'warning',
        tags: {
          operation: 'sign_in',
          rate_limit_type: 'email',
        },
        extra: {
          email,
          attempts: emailAttempts,
        },
      });

      throw new HttpException(
        'Too many login attempts for this account. Please try again later or reset your password.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Increment counter with 15-minute TTL
    await this.cacheManager.set(
      emailRateLimitKey,
      emailAttempts + 1,
      900 * 1000,
    );
  }

  /**
   * Check if account is locked due to failed attempts
   * Implements progressive lockout
   */
  private async isAccountLocked(email: string): Promise<boolean> {
    const lockKey = `account_lock:${email}`;
    const lockData = await this.cacheManager.get<{
      lockedUntil: number;
      attempts: number;
    }>(lockKey);

    if (!lockData) {
      return false;
    }

    // Check if lock has expired
    if (Date.now() > lockData.lockedUntil) {
      await this.cacheManager.del(lockKey);
      return false;
    }

    return true;
  }

  /**
   * Handle failed login attempts with progressive lockout
   */
  private async handleFailedLogin(
    email: string,
    ipAddress: string,
    reason: string,
  ): Promise<void> {
    const failedAttemptsKey = `failed_login:${email}`;
    const lockKey = `account_lock:${email}`;

    // Get current failed attempts
    const currentAttempts =
      (await this.cacheManager.get<number>(failedAttemptsKey)) || 0;
    const newAttempts = currentAttempts + 1;

    // Store failed attempts with 30-minute TTL
    await this.cacheManager.set(failedAttemptsKey, newAttempts, 1800 * 1000);

    // Log failed attempt
    this.logger.warn(
      `Failed login attempt ${newAttempts} for ${email} from ${ipAddress}. Reason: ${reason}`,
    );

    // Progressive lockout strategy
    if (newAttempts >= 10) {
      // 10+ attempts: Lock for 1 hour
      const lockDuration = 3600 * 1000;
      await this.lockAccount(email, lockKey, newAttempts, lockDuration);

      Sentry.captureMessage('Account locked - excessive failed attempts', {
        level: 'error',
        tags: {
          operation: 'sign_in',
          security_event: 'account_locked',
        },
        extra: {
          email,
          ipAddress,
          attempts: newAttempts,
          lockDuration: '1 hour',
        },
      });
    } else if (newAttempts >= 7) {
      // 7-9 attempts: Lock for 15 minutes
      const lockDuration = 900 * 1000;
      await this.lockAccount(email, lockKey, newAttempts, lockDuration);
    } else if (newAttempts >= 5) {
      // 5-6 attempts: Lock for 5 minutes
      const lockDuration = 300 * 1000;
      await this.lockAccount(email, lockKey, newAttempts, lockDuration);

      Sentry.captureMessage('Account temporarily locked', {
        level: 'warning',
        tags: {
          operation: 'sign_in',
          security_event: 'temp_lock',
        },
        extra: {
          email,
          ipAddress,
          attempts: newAttempts,
        },
      });
    }
  }

  /**
   * Lock account for specified duration
   */
  private async lockAccount(
    email: string,
    lockKey: string,
    attempts: number,
    duration: number,
  ): Promise<void> {
    await this.cacheManager.set(
      lockKey,
      {
        lockedUntil: Date.now() + duration,
        attempts,
      },
      duration,
    );

    this.logger.warn(
      `Account locked: ${email} for ${duration / 1000} seconds after ${attempts} failed attempts`,
    );
  }

  /**
   * Clear failed login attempts on successful login
   */
  private async clearFailedAttempts(
    email: string,
    ipAddress: string,
  ): Promise<void> {
    const failedAttemptsKey = `failed_login:${email}`;
    const lockKey = `account_lock:${email}`;

    await Promise.all([
      this.cacheManager.del(failedAttemptsKey),
      this.cacheManager.del(lockKey),
    ]);

    this.logger.log(`Cleared failed attempts for ${email}`);
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
    const [user] = await this.dbServer
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
    const startTime = Date.now();
    let userExists = false;
    let shouldSendEmail = false;

    try {
      // 1. Rate limit by IP (global)
      const ipRateLimitKey = `pwd_reset_ip:${ipAddress}`;
      const currentIpAttempts =
        (await this.cacheManager.get<number>(ipRateLimitKey)) || 0;
      const ipAttempts = currentIpAttempts + 1;

      await this.cacheManager.set(ipRateLimitKey, ipAttempts, 3600 * 1000);

      if (ipAttempts > 3) {
        this.logger.warn(
          `Too many password reset requests from IP: ${ipAddress}`,
        );

        // Add artificial delay before throwing to prevent timing analysis
        await this.addConstantTimeDelay(startTime);

        throw new HttpException(
          'Too many requests',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // 2. Rate limit by email
      const emailRateLimitKey = `pwd_reset_email:${email}`;
      const currentEmailAttempts =
        (await this.cacheManager.get<number>(emailRateLimitKey)) || 0;
      const emailAttempts = currentEmailAttempts + 1;

      await this.cacheManager.set(
        emailRateLimitKey,
        emailAttempts,
        3600 * 1000,
      );

      const emailRateLimited = emailAttempts > 3;

      // Find user by email (always execute)
      const [user] = await this.dbServer
        .select()
        .from(UserTable)
        .where(eq(UserTable.email, email))
        .limit(1);

      userExists = !!user;

      // Determine if we should actually send email
      shouldSendEmail =
        userExists &&
        !emailRateLimited &&
        (!user.resetPasswordExpires ||
          user.resetPasswordExpires <= new Date(Date.now() - 300000));

      // Always generate token (even if not used) to maintain constant time
      const {
        token: resetToken,
        hashedToken,
        expiresAt,
      } = await this.generateAndHashToken(15);

      // Update database if user exists and should send email
      if (shouldSendEmail) {
        await this.dbServer
          .update(UserTable)
          .set({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: expiresAt,
          })
          .where(eq(UserTable.id, user.id));

        const publicUrl = this.configService.publicUrl;
        if (!publicUrl) {
          this.logger.error('CLIENT_URLS is not configured');
          throw new HttpException(
            'Server configuration error',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        const resetUrl = `${publicUrl}/${acceptLanguage}/reset-password?token=${resetToken}`;

        // Send email asynchronously (to maintain timing)
        this.inngest
          .send({
            name: 'jobxhub/user.reset_password',
            data: {
              email,
              resetUrl,
              acceptLanguage,
            },
          })
          .catch((error) => {
            // Log error to Sentry
            Sentry.captureException(error, {
              tags: {
                operation: 'password_reset',
                email_sent: 'false',
              },
              extra: {
                email,
                acceptLanguage,
              },
            });
            this.logger.error('Failed to send password reset email', error);
          });
      }

      // Log different scenarios to Sentry for monitoring
      if (!userExists) {
        this.logger.warn(
          `Password reset requested for non-existent email: ${email} at ${this.getTimestamp()}`,
        );
        Sentry.captureMessage('Password reset for non-existent email', {
          level: 'warning',
          tags: {
            operation: 'password_reset',
            user_exists: 'false',
          },
          extra: {
            email,
            ipAddress,
          },
        });
      } else if (emailRateLimited) {
        this.logger.warn(`Rate limit exceeded for email: ${email}`);
        Sentry.captureMessage('Password reset rate limit exceeded', {
          level: 'warning',
          tags: {
            operation: 'password_reset',
            rate_limited: 'true',
          },
          extra: {
            email,
            ipAddress,
            attempts: emailAttempts,
          },
        });
      }

      // Add constant-time delay to normalize response time
      await this.addConstantTimeDelay(startTime);

      // Always return same response
      return {
        message: 'Password reset email sent. Please check your inbox',
      };
    } catch (error) {
      // Capture unexpected errors in Sentry
      if (!(error instanceof HttpException)) {
        Sentry.captureException(error, {
          tags: {
            operation: 'password_reset',
          },
          extra: {
            email,
            ipAddress,
            acceptLanguage,
          },
        });
      }

      throw error;
    }
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
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user by reset token and check expiration
    const [user] = await this.dbServer
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
    const hashedPassword = await hashPassword(newPassword);

    // Update user's password and clear reset token fields
    await this.dbServer
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
    return {
      message: 'Password reset successfully',
    };
  };

  async signOut(userId: string) {
    try {
      // 1. Get user data to clear cache properly
      const [user] = await this.dbServer
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
        return {
          message: 'Signed out successfully',
        };
      }

      // 2. Increment token version to invalidate all existing tokens
      await this.dbServer
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

      return {
        message: 'Signed out successfully',
      };
    } catch (error) {
      // Log error but don't fail the sign-out
      Sentry.captureException(error, {
        tags: {
          operation: 'sign_out',
        },
        extra: {
          userId,
        },
      });

      this.logger.error(`Sign out error for user ${userId}: ${error?.message}`);

      // Still return success - user experience is more important
      return {
        message: 'Signed out successfully',
      };
    }
  }
}
