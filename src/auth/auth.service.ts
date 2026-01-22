import { DrizzleService } from '@/drizzle/drizzle.service';
import { S3Service } from '@/s3/s3.service';
import { catchAsync } from '@/utils/catch-async';
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
  ) {}

  private get redisServer() {
    if (!this.cacheManager) {
      this.logger.error(`Redis server is down at ${new Date().toISOString()}`);
      throw new InternalServerErrorException('Cache service unavailable');
    }
    return this.cacheManager;
  }

  private get inngest() {
    if (!this.inngestService || !this.inngestService.inngest) {
      this.logger.error(`Inngest client is down at ${this.getTimestamp()}`);
      throw new InternalServerErrorException('Event service unavailable');
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
      throw new InternalServerErrorException('Database unavailable');
    }
    return this.dbService.db;
  }

  private get s3Server() {
    if (!this.s3Service) {
      this.logger.error(`S3 service is down at ${this.getTimestamp()}`);
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

  private async cacheUser(user: any, ttl: number = 900) {
    const { password, verificationToken, verificationExpires, ...safeUser } =
      user;
    const cacheKey = `user:email:${safeUser.email}`;
    await this.redisServer.set(cacheKey, JSON.stringify(safeUser), ttl);
  }

  private async getCachedUser(email: string) {
    const cacheKey = `user:email:${email}`;
    const cached = await this.redisServer.get<string>(cacheKey);
    return cached ? JSON.parse(cached) : null;
  }

  async signUp(
    data: SignUpDto,
    imageFile: Express.Multer.File,
    acceptLanguage: string,
  ) {
    const { username, password, email, firstName, lastName, dateOfBirth } =
      data;

    // Validate required fields
    if (
      !username ||
      !password ||
      !email ||
      !firstName ||
      !lastName ||
      !dateOfBirth
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

      const frontendUrl = this.configService.clientUrl;
      const locale = acceptLanguage || 'en';

      if (!frontendUrl) {
        throw new InternalServerErrorException(
          'Application configuration error',
        );
      }

      const verificationUrl = `${frontendUrl}/${locale}/auth/verify-email?token=${verificationToken}`;

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
          userRole: 'USER',
          verificationToken: hashedVerificationToken,
          verificationExpires: verificationExpires,
        })
        .returning();

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
  }

  async verifyEmail(token: string) {
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
      throw new UnauthorizedException('Invalid or expired verification token');
    }

    await this.dbServer
      .update(UserTable)
      .set({
        isVerified: true,
        verificationToken: null,
        verificationExpires: null,
      })
      .where(eq(UserTable.id, user.id));

    this.logger.log(`Email successfully verified for user ID: ${user.id}`);

    return {
      message: 'Email verified successfully',
    };
  }

  async signIn(data: SignInDto) {
    const { email, password } = data;

    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
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
        throw new UnauthorizedException('Invalid credentials');
      }

      if (dbStatus.isBanned) {
        throw new UnauthorizedException('Account has been banned');
      }

      if (dbStatus.isDisabled) {
        throw new UnauthorizedException('Account has been disabled');
      }

      if (!dbStatus.isVerified) {
        throw new UnauthorizedException('Please verify your email first');
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
        throw new UnauthorizedException('Invalid credentials');
      }

      if (dbUser.isBanned) {
        throw new UnauthorizedException('Account has been banned');
      }

      if (dbUser.isDisabled) {
        throw new UnauthorizedException('Account has been disabled');
      }

      if (!dbUser.isVerified) {
        throw new UnauthorizedException('Please verify your email first');
      }

      passwordHash = dbUser.password;
      user = dbUser;

      await this.cacheUser(user);
    }

    const isPasswordValid = await bcrypt.compare(password, passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      email: user.email,
      sub: user.id,
      tokenVersion: user.tokenVersion,
    };

    const token = this.generateToken(payload);

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      imageUrl: user.imageUrl,
      userRole: user.userRole,
      token,
    };
  }
}
