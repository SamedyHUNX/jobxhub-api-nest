import { AuthService } from '@/auth/auth.service';
import { ConfigService } from '@/config/config.service';
import { DrizzleService } from '@/drizzle/drizzle.service';
import { S3Service } from '@/s3/s3.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UpdatedMeDataDto } from './dtos/update-me.dto';
import { UserTable } from '@/drizzle/schema';
import { and, eq, not } from 'drizzle-orm';
import type { Cache } from 'cache-manager';
import * as Sentry from '@sentry/nestjs';
import { InngestClientService } from '@/inngest/services/inngest.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private jwtService: JwtService,
    private dbService: DrizzleService,
    private s3Service: S3Service,
    private inngestHealth: InngestClientService,
    private configService: ConfigService,
  ) {}

  private getTimestamp(): string {
    return new Date().toISOString();
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

  updateMe = async (
    userId: string,
    data: UpdatedMeDataDto,
    imageFile?: Express.Multer.File,
  ) => {
    const { firstName, lastName, username, phoneNumber } = data;

    // Variable to track uploaded image for cleanup
    let uploadedImageKey: string | undefined;

    try {
      // Check if username is being updated and if it's already taken
      if (username) {
        const existingUser = await this.dbService.db
          .select({ id: UserTable.id })
          .from(UserTable)
          .where(
            and(
              eq(UserTable.username, username),
              not(eq(UserTable.id, userId)),
            ),
          )
          .limit(1);

        if (existingUser.length > 0) {
          throw new ConflictException('Username already taken');
        }
      }

      // Build update object with only provided fields
      const updateData: Partial<typeof UserTable.$inferInsert> = {};

      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (username !== undefined) updateData.username = username;
      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;

      // Handle image upload if provided
      let oldImageUrl: string | undefined;

      if (imageFile) {
        // Get the current image URL to delete later
        const [currentUser] = await this.dbService.db
          .select({ imageUrl: UserTable.imageUrl })
          .from(UserTable)
          .where(eq(UserTable.id, userId))
          .limit(1);

        oldImageUrl = currentUser?.imageUrl;

        // Upload new image
        const { key, url } = await this.s3Server.uploadFileAndGetUrl(
          imageFile,
          'users',
          'avatars',
        );

        uploadedImageKey = key; // Track for cleanup
        updateData.imageUrl = url;
      }

      // Only proceed if there's data to update
      if (Object.keys(updateData).length === 0) {
        throw new BadRequestException('No fields to update');
      }

      // Perform the update
      const [updatedUser] = await this.dbService.db
        .update(UserTable)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(UserTable.id, userId))
        .returning();

      if (!updatedUser) {
        // Cleanup uploaded file if update failed
        if (uploadedImageKey) {
          await this.s3Server.deleteFile(uploadedImageKey);
        }
        throw new NotFoundException('User not found');
      }

      // Delete old image from S3 if a new one was uploaded
      if (oldImageUrl && uploadedImageKey) {
        try {
          // Extract the key from the old URL
          const oldKey = oldImageUrl.split('/').slice(3).join('/');
          await this.s3Server.deleteFile(oldKey);
        } catch (deleteError) {
          // Log but don't fail the request if old image deletion fails
          this.logger.warn(
            `Failed to delete old image for user ${userId}: ${deleteError}`,
          );
        }
      }

      // Invalidate cache for this user using the same keys as auth.service
      await this.cacheManager.del(`user:id:${userId}`);
      await this.cacheManager.del(`user:email:${updatedUser.email}`);

      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;

      this.logger.log(`User ${userId} updated their profile`);

      return {
        message: 'Updated user successfully',
        data: {
          users: userWithoutPassword,
        },
      };
    } catch (error) {
      // Cleanup uploaded image if something went wrong
      if (uploadedImageKey) {
        this.logger.warn(
          `Operation failed. Deleting orphaned file: ${uploadedImageKey}`,
        );
        await this.s3Server
          .deleteFile(uploadedImageKey)
          .catch((e) =>
            this.logger.error(
              `Failed to delete ${uploadedImageKey}: ${e.message}`,
            ),
          );
      }
      this.logger.error(`Failed to update user ${userId}:`, error);
      throw error;
    }
  };
}
