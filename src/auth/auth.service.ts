import { AppService } from '@/app.service';
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
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SignUpDto } from './dtos/auth.dto';
import { eq, or } from 'drizzle-orm';
import { capitalizeString, hashPassword } from '@/utils/helpers';
import * as crypto from 'crypto';
import { UserTable } from '@/drizzle/schema';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InngestClientService } from '@/inngest/inngest-client.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AppService.name);
  constructor(
    private jwtService: JwtService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private dbService: DrizzleService,
    private s3Service: S3Service,
    private inngestService: InngestClientService,
  ) {}

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
    // Set token and expiration (1 hour)
    const expiresAt = new Date(Date.now() + expireMinutes * 60 * 1000);
    return { token, hashedToken, expiresAt };
  }

  signUp = catchAsync(
    async (
      data: SignUpDto,
      file: Express.Multer.File,
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
        file,
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

      if (!file || !file.originalname) {
        throw new ConflictException(
          ResponseHelper.error(ResponseCode.MISSING_PHOTO),
        );
      }

      // Sanitize filename to prevent path traversal
      const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');

      // Upload image to S3
      const imageKey = `users/avatars/${Date.now()}-${sanitizedName}`;
      await this.s3Server.uploadFile(file, imageKey);

      // Get the S3 URL (public or presigned)
      const imageUrl = `${process.env.R2_PUBLIC_DOMAIN}/${imageKey}`;

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
        const verificationUrl = `${process.env.FRONTEND_URL}/${acceptLanguage}/auth/verify-email?token=${verificationToken}`;

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
            acceptLanguage: acceptLanguage || 'en',
          },
        });

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
}
