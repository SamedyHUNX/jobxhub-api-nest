import { DrizzleService } from '@/drizzle/drizzle.service';
import { S3Service } from '@/s3/s3.service';
import { catchAsync } from '@/utils/catch-async';
import { ResponseCode, ResponseHelper } from '@/utils/response-helper';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SignInDto, SignUpDto } from './dtos/auth.dto';
import { and, eq, gt, or } from 'drizzle-orm';
import {
  capitalizeString,
  hashPassword,
  sanitizedEmail,
} from '@/utils/helpers';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { UserTable } from '@/drizzle/schema';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InngestClientService } from '@/inngest/inngest.service';
import { ConfigService } from '@/config/config.service';

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
  ) { }

  private get redisServer() {
    if (!this.cacheManager) {
      this.logger.error(`Redis server is down at ${new Date().toISOString()}`);
      throw new InternalServerErrorException(
        ResponseHelper.error(ResponseCode.SERVICE_UNAVAILABLE),
      );
    }
    return this.cacheManager;
  }

  private get inngest() {
    if (!this.inngestService || !this.inngestService.inngest) {
      this.logger.error(`Inngest client is down at ${this.getTimestamp()}`);
      throw new InternalServerErrorException(
        ResponseHelper.error(ResponseCode.SERVICE_UNAVAILABLE),
      );
    }
    return this.inngestService.inngest;
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private get dbServer() {
    if (!this.dbService.db) {
      this.logger.error(
        `Database connection not established at ${this.getTimestamp()}`,
      );
      throw new InternalServerErrorException(
        ResponseHelper.error(ResponseCode.SERVICE_UNAVAILABLE),
      );
    }
    return this.dbService.db;
  }

  private get s3Server() {
    if (!this.s3Service) {
      this.logger.error(`S3 service is down at ${this.getTimestamp()}`);
      throw new InternalServerErrorException(
        ResponseHelper.error(ResponseCode.SERVICE_UNAVAILABLE),
      );
    }
    return this.s3Service;
  }

  private generateToken(payload: any) {
    return this.jwtService.sign(payload);
  }

  private async generateAndHashToken(expireMinutes: number) {
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    // Set token and expiration based on provided minutes
    const expiresAt = new Date(Date.now() + expireMinutes * 60 * 1000);
    return { token, hashedToken, expiresAt };
  }

  private async cacheUser(user: any, ttl: number = 900) {
    // Exlude sensitive fields before caching
    const { password, verificationToken, verificationExpires, ...safeUser } =
      user;
    user = safeUser;
    const cacheKey = `user:email:${user.email}`;
    await this.redisServer.set(cacheKey, JSON.stringify(user), ttl);
  }

  private async getCachedUser(email: string) {
    const cacheKey = `user:email:${email}`;
    const cached = await this.redisServer.get<string>(cacheKey);
    return cached ? JSON.parse(cached) : null;
  }

  // Sign up function
  signUp = catchAsync(
    async (
      data: SignUpDto,
      imageFile: Express.Multer.File,
      acceptLanguage: string,
    ) => {
      const { username, password, email, firstName, lastName, dateOfBirth } =
        data;

      // Validate required fields from DTO
      const requiredFields = {
        username,
        password,
        email,
        firstName,
        lastName,
        imageFile,
        dateOfBirth,
      };

      for (const [key, value] of Object.entries(requiredFields)) {
        if (!value) {
          this.logger.error(`Missing ${key}`);
          throw new BadRequestException(
            ResponseHelper.error(ResponseCode.MISSING_FIELDS, key),
          );
        }
      }

      // Check if email or username already exists
      const existingUser = await this.dbServer
        .select()
        .from(UserTable)
        .where(or(eq(UserTable.email, email), eq(UserTable.username, username)))
        .limit(1);

      if (existingUser.length > 0) {
        if (existingUser[0].email === email) {
          this.logger.warn('Signup attempt with existing email');
          throw new ConflictException(
            ResponseHelper.error(ResponseCode.EXISTING_EMAIL),
          );
        }
        if (existingUser[0].username === username) {
          throw new ConflictException(
            ResponseHelper.error(ResponseCode.EXISTING_USERNAME),
          );
        }
      }

      if (!imageFile || !imageFile.originalname) {
        throw new BadRequestException(
          ResponseHelper.error(ResponseCode.MISSING_PHOTO),
        );
      }

      // Sanitize filename to prevent path traversal
      const sanitizedName = imageFile.originalname.replace(
        /[^a-zA-Z0-9._-]/g,
        '_',
      );

      // Upload image to S3
      const imageKey = `users/avatars/${Date.now()}-${sanitizedName}`;
      await this.s3Server.uploadFile(imageFile, imageKey);

      // Get the S3 URL (public or presigned)
      const storageProvider = this.configService.storageProvider;
      const publicDomain =
        storageProvider === 'r2'
          ? this.configService.r2PublicDomain
          : this.configService.s3PublicDomain;

      if (!publicDomain) {
        throw new InternalServerErrorException(
          ResponseHelper.error(ResponseCode.SERVICE_UNAVAILABLE),
        );
      }
      const imageUrl = `${publicDomain}/${imageKey}`;

      try {
        // Hash password
        const hashedPassword = await hashPassword(password);

        // Make sure names are capitalized before placing in DB
        const capitalizedFirstName = capitalizeString(firstName);
        const capitalizedLastName = capitalizeString(lastName);

        // Generate email verification token
        const {
          token: verificationToken,
          hashedToken: hashedVerificationToken,
          expiresAt: verificationExpires,
        } = await this.generateAndHashToken(60 * 24); // 24 hours expiration

        // Send email with reset link
        const frontendUrl = this.configService.clientUrl;
        const locale = acceptLanguage || 'en';
        if (!frontendUrl) {
          throw new InternalServerErrorException(
            ResponseHelper.error(ResponseCode.SERVICE_UNAVAILABLE),
          );
        }
        const verificationUrl = `${frontendUrl}/${locale}/auth/verify-email?token=${verificationToken}`;

        // Create user
        const [user] = await this.dbServer
          .insert(UserTable)
          .values({
            username,
            email,
            firstName: capitalizedFirstName,
            lastName: capitalizedLastName,
            dateOfBirth: new Date(dateOfBirth),
            password: hashedPassword,
            imageUrl,
            userRole: 'USER', // Explicity set the userRole to 'USER' for security reason
            verificationToken: hashedVerificationToken,
            verificationExpires: verificationExpires,
          })
          .returning();

        // TRIGGER INNGEST EVENT for email verification
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
        } catch (err: any) {
          this.logger.error(
            `Failed to emit user.created event: ${err?.message ?? err}`,
          );
        }

        return {
          message: 'User signed up successfully. Please verify your email.',
        };
      } catch (error) {
        // If database insertion falsi, delete the uploaded file from S3
        this.logger.warn(
          `Database insertion failed. Deleting orphaned file: ${imageKey}`,
        );
        try {
          await this.s3Server.deleteFile(imageKey);
        } catch (s3Error: any) {
          this.logger.error(
            `Failed to delete orphaned file ${imageKey}: ${s3Error.message}`,
          );
        }
        throw error;
      }
    },
    this.logger,
    `Failed to sign up user`,
  );

  // Verify email function
  verifyEmail = catchAsync(
    async (token: string) => {
      // Hash the token from URL to compare with stored hash
      const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

      // Find user by verification token and check expiration
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
        this.logger.error('Invalid or expired email verification token used');
        throw new UnauthorizedException(
          ResponseHelper.error(ResponseCode.INVALID_TOKEN),
        );
      }

      // Update user's verified status and clear verification token fields
      await this.dbServer
        .update(UserTable)
        .set({
          isVerified: true,
          verificationToken: null,
          verificationExpires: null,
        })
        .where(eq(UserTable.id, user.id));

      this.logger.log(`Email successfully verified for user ID: ${user.id}`);
      return ResponseHelper.success(ResponseCode.EMAIL_VERIFIED);
    },
    this.logger,
    'Failed to verify email',
  );

  // SignIn function
  signIn = catchAsync(
    async (data: SignInDto) => {
      const { email, password } = data;

      if (!email || !password) {
        this.logger.error(
          `User with email ${sanitizedEmail(email)} missing required fields`,
        );
        throw new ConflictException(
          ResponseHelper.error(ResponseCode.MISSING_FIELDS),
        );
      }

      // Try to get user from Redis cache
      const cachedUser = await this.getCachedUser(email);

      let user;
      let passwordHash: string;

      if (cachedUser) {
        user = cachedUser;

        // Verify user status from DB to prevent cache inconsistencies
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
          // User deleted but still in cache
          this.logger.error(
            `User with ${sanitizedEmail(email)} found in cache but not in database`,
          );
          throw new UnauthorizedException(
            ResponseHelper.error(ResponseCode.INVALID_CREDENTIALS),
          );
        }

        // Check if user is banned
        if (dbStatus.isBanned) {
          this.logger.error(`User with ${sanitizedEmail(email)} is banned`);
          throw new UnauthorizedException(
            ResponseHelper.error(ResponseCode.USER_BANNED),
          );
        }

        // Check if user is disabled
        if (dbStatus.isDisabled) {
          this.logger.error(`User with ${sanitizedEmail(email)} is disabled`);
          throw new UnauthorizedException(
            ResponseHelper.error(ResponseCode.USER_DISABLED),
          );
        }

        // Check if user is verified
        if (!dbStatus.isVerified) {
          this.logger.error(
            `User with ${sanitizedEmail(email)} is not verified`,
          );
          throw new UnauthorizedException(
            ResponseHelper.error(ResponseCode.USER_NOT_VERIFIED),
          );
        }

        // Separate password from status
        const { password: dbPassword, ...status } = dbStatus;
        passwordHash = dbPassword;

        // Update user with fresh status ONLY (no password hash)
        user = { ...user, ...status };

        // Update cache with fresh sanitized user
        await this.cacheUser(user);
      } else {
        // Find user in database
        const [dbUser] = await this.dbServer
          .select()
          .from(UserTable)
          .where(eq(UserTable.email, email))
          .limit(1);

        if (!dbUser) {
          this.logger.error(
            `User with ${sanitizedEmail(email)} trying to signin with invalid credentials`,
          );
          throw new UnauthorizedException(
            ResponseHelper.error(ResponseCode.INVALID_CREDENTIALS),
          );
        }

        // Check if user is banned
        if (dbUser.isBanned) {
          this.logger.error(`User with ${sanitizedEmail(email)} is banned`);
          throw new UnauthorizedException(
            ResponseHelper.error(ResponseCode.USER_BANNED),
          );
        }

        // Check if user is disabled
        if (dbUser.isDisabled) {
          this.logger.error(`User with ${sanitizedEmail(email)} is disabled`);
          throw new UnauthorizedException(
            ResponseHelper.error(ResponseCode.USER_DISABLED),
          );
        }

        // Check if user is verified
        if (!dbUser.isVerified) {
          this.logger.error(
            `User with ${sanitizedEmail(email)} is not verified`,
          );
          throw new UnauthorizedException(
            ResponseHelper.error(ResponseCode.USER_NOT_VERIFIED),
          );
        }

        passwordHash = dbUser.password;
        user = dbUser;

        // Cache for 15 minutes (900 seconds)
        // cacheUser will strip sensitive fields like password before caching
        await this.cacheUser(user);
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, passwordHash);

      if (!isPasswordValid) {
        this.logger.error(
          `User with ${sanitizedEmail(email)} trying to signin with invalid password at ${this.getTimestamp()}`,
        );
        throw new UnauthorizedException(
          ResponseHelper.error(ResponseCode.INVALID_CREDENTIALS),
        );
      }

      const payload = {
        email: user.email,
        sub: user.id,
        tokenVersion: user.tokenVersion,
      };

      const token = this.generateToken(payload);

      const resUser = {
        id: user.id,
        email: user.email,
        username: user.username,
        imageUrl: user.imageUrl,
        userRole: user.userRole,
        token,
      };

      return ResponseHelper.success(ResponseCode.SIGNIN_SUCCESS, {
        users: [resUser],
      });
    },
    this.logger,
    'Failed to sign in user',
  );
}
