import { AuthService } from '@/auth/auth.service';
import { DrizzleService } from '@/drizzle/services/drizzle.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UpdatedMeDataDto } from './dtos/update-me.dto';
import { UserTable } from '@/drizzle/schema';
import { and, eq, not } from 'drizzle-orm';
import { S3HealthService } from '@/s3/services/s3-health.service';
import { UserCacheService } from '@/cache/services/user-cache.service';
import { Permissions } from '@/utils/rbac/permissions';
import { PermissionService } from '@/common/services/permission.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private dbService: DrizzleService,
    private s3Health: S3HealthService,
    private userCacheService: UserCacheService,
    private readonly permission: PermissionService
  ) { }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private get userCache() {
    return this.userCacheService;
  }


  private get s3() {
    return this.s3Health.s3;
  }

  getAll = async (userId: string, userRole: string) => {
    if (!this.permission.hasAppPermission(userRole, Permissions.READ_ALL_USERS)) {
      throw new UnauthorizedException('You cannot access this feature')
    }

    try {
      const users = await this.dbService.db
        .select({
          id: UserTable.id,
          email: UserTable.email,
          firstName: UserTable.firstName,
          lastName: UserTable.lastName,
          username: UserTable.username,
          imageUrl: UserTable.imageUrl,
          userRole: UserTable.userRole,
          phoneNumber: UserTable.phoneNumber,
          dateOfBirth: UserTable.dateOfBirth,
          createdAt: UserTable.createdAt,
          updatedAt: UserTable.updatedAt,
        })
        .from(UserTable)
        .where(not(eq(UserTable.id, userId)))
        .limit(10);


      if (!users || users.length === 0) {
        throw new NotFoundException('Users not found');
      }

      return users;
    } catch (error) {
      throw error;
    }
  }

  update = async (
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
        const { key, url } = await this.s3.uploadFileAndGetUrl(
          imageFile,
          'users',
          'avatars',
        );

        console.log('diddy', url)

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
          await this.s3.deleteFile(uploadedImageKey);
        }
        throw new NotFoundException('User not found');
      }

      // Delete old image from S3 if a new one was uploaded
      if (oldImageUrl && uploadedImageKey) {
        try {
          // Extract the key from the old URL
          const oldKey = oldImageUrl.split('/').slice(3).join('/');
          await this.s3.deleteFile(oldKey);
        } catch (deleteError) {
          // Log but don't fail the request if old image deletion fails
          this.logger.warn(
            `Failed to delete old image for user ${userId}: ${deleteError}`,
          );
        }
      }

      // Invalidate cache for this user using the same keys as auth.service
      await this.userCache.invalidateUser(updatedUser.email, updatedUser.id);

      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;

      this.logger.log(`User ${userId} updated their profile`);

      return userWithoutPassword;
    } catch (error) {
      // Cleanup uploaded image if something went wrong
      if (uploadedImageKey) {
        this.logger.warn(
          `Operation failed. Deleting orphaned file: ${uploadedImageKey}`,
        );
        await this.s3
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
