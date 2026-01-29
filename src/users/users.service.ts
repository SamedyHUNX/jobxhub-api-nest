import { AuthService } from '@/auth/auth.service';
import { ConfigService } from '@/config/config.service';
import { DrizzleService } from '@/drizzle/drizzle.service';
import { InngestClientService } from '@/inngest/inngest.service';
import { S3Service } from '@/s3/s3.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UpdatedMeDataDto } from './dtos/update-me.dto';
import { UserTable } from '@/drizzle/schema';
import { and, eq, not } from 'drizzle-orm';
import type { Cache } from 'cache-manager';
import { getImageKey } from '@/utils/helpers';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private jwtService: JwtService,
    private dbService: DrizzleService,
    private s3Service: S3Service,
    private inngestService: InngestClientService,
    private configService: ConfigService,
  ) { }

  updateMe = async (
    userId: string,
    data: UpdatedMeDataDto,
    imageFile?: Express.Multer.File,
  ) => {
    const { firstName, lastName, username, phoneNumber } = data;

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
      let imageUrl: string | undefined;
      let imageKey: string | undefined;
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
        const sanitizedName = imageFile.originalname.replace(
          /[^a-zA-Z0-9._-]/g,
          '_',
        );

        imageKey = getImageKey("users", "avatars", sanitizedName)

        await this.s3Service.uploadFile(imageFile, imageKey);

        // Get S3 URL from config
        const storageProvider = this.configService.storageProvider;
        const publicDomain =
          storageProvider === 'r2'
            ? this.configService.r2PublicDomain
            : this.configService.awsS3PublicDomain;

        if (!publicDomain) {
          await this.s3Service.deleteFile(imageKey);
          throw new BadRequestException('Storage configuration error');
        }

        imageUrl = `${publicDomain}/${imageKey}`;
        updateData.imageUrl = imageUrl;
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
        if (imageKey) {
          await this.s3Service.deleteFile(imageKey);
        }
        throw new NotFoundException('User not found');
      }

      // Delete old image from S3 if a new one was uploaded
      if (oldImageUrl && imageKey) {
        try {
          // Extract the key from the old URL
          const oldKey = oldImageUrl.split('/').slice(3).join('/');
          await this.s3Service.deleteFile(oldKey);
        } catch (deleteError) {
          // Log but don't fail the request if old image deletion fails
          this.logger.warn(
            `Failed to delete old image for user ${userId}: ${deleteError}`,
          );
        }
      }

      // Invalidate cache for this user using the same keys as auth.service
      // Cache keys: user:id:${userId} and user:email:${email}
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
      this.logger.error(`Failed to update user ${userId}:`, error);
      throw error;
    }
  };
}
