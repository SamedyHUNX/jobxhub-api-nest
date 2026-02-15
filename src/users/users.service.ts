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
import { Permissions } from '@/permissions/utils/app-permissions';
import { AppPermissionService } from '@/permissions/services/app-permissions.service';
import type { User } from '@/types';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(
    private dbService: DrizzleService,
    private s3Service: S3HealthService,
    private userCacheService: UserCacheService,
    private readonly appPermission: AppPermissionService
  ) { }

  getAll = async (user: User) => {
    if (!this.appPermission.hasPermission(user, null, Permissions.READ_ALL_USERS)) {
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
        .where(not(eq(UserTable.id, user.id)))
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
    user: User,
    data: UpdatedMeDataDto,
    imageFile?: Express.Multer.File,
  ) => {
    const { firstName, lastName, username, phoneNumber } = data;

    if (!this.appPermission.hasPermission(user, null, Permissions.UPDATE_MY_PROFILE)) {
      throw new UnauthorizedException('You cannot update your profile')
    }

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
              not(eq(UserTable.id, user.id)),
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
          .where(eq(UserTable.id, user.id))
          .limit(1);

        oldImageUrl = currentUser?.imageUrl;

        // Upload new image
        const { key, url } = await this.s3Service.s3().uploadFileAndGetUrl(
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
        .where(eq(UserTable.id, user.id))
        .returning();

      if (!updatedUser) {
        // Cleanup uploaded file if update failed
        if (uploadedImageKey) {
          await this.s3Service.s3().deleteFile(uploadedImageKey);
        }
        throw new NotFoundException('User not found');
      }

      // Delete old image from S3 if a new one was uploaded
      if (oldImageUrl && uploadedImageKey) {
        try {
          // Extract the key from the old URL
          const oldKey = oldImageUrl.split('/').slice(3).join('/');
          await this.s3Service.s3().deleteFile(oldKey);
        } catch (deleteError) {
          // Log but don't fail the request if old image deletion fails
          this.logger.warn(
            `Failed to delete old image for user ${user.id}: ${deleteError}`,
          );
        }
      }

      // Invalidate cache for this user using the same keys as auth.service
      await this.userCacheService.invalidateUser(updatedUser.id);

      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;

      this.logger.log(`User ${user.id} updated their profile`);

      return userWithoutPassword;
    } catch (error) {
      // Cleanup uploaded image if something went wrong
      if (uploadedImageKey) {
        this.logger.warn(
          `Operation failed. Deleting orphaned file: ${uploadedImageKey}`,
        );
        await this.s3Service.s3()
          .deleteFile(uploadedImageKey)
          .catch((e) =>
            this.logger.error(
              `Failed to delete ${uploadedImageKey}: ${e.message}`,
            ),
          );
      }
      this.logger.error(`Failed to update user ${user.id}:`, error);
      throw error;
    }
  };
}
