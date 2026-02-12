import { ConfigService } from '@/common/services/config.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateOrganizationDto } from './dtos/create-organization.dto';
import {
  OrganizationTable,
  OrganizationUserSettingsTable,
  UserSubscriptionsTable,
  UserTable,
} from '@/drizzle/schema';
import type { Cache } from 'cache-manager';
import { and, desc, eq, like, not, or, SQL } from 'drizzle-orm';
import { InngestHealthService } from '@/inngest/services/inngest-health.service';
import { DrizzleHealthService } from '@/drizzle/services/drizzle-health.service';
import { S3HealthService } from '@/s3/services/s3-health.service';
import { CacheHealthService } from '@/cache/services/cache-health.service';
import { SubscriptionPermissionsService } from '@/permissions/services/subscription-permissions.service';
import { getSubscriptionPlans } from '@/stripe/types/subscription-plans';
import { AppPermissionService } from '@/permissions/services/app-permissions.service';
import type { User } from '@/types';
import { UpdateOrganizationDto } from './dtos/update-organization.dto';
import { Permissions } from '@/permissions/utils/app-permissions';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private dbService: DrizzleHealthService,
    private s3Service: S3HealthService,
    private readonly configService: ConfigService,
    private inngestService: InngestHealthService,
    private cacheService: CacheHealthService,
    private subscriptionPermissionsService: SubscriptionPermissionsService,
    private appPermissionService: AppPermissionService,
  ) { }
  // Get all orgs with optional filtering
  findAll = async (userId: string, search?: string, isVerified?: boolean) => {
    const cacheKey = `orgs:all${search ? `:search:${search}` : ''}${isVerified !== undefined ? `:verified:${isVerified}` : ''}${userId ? `:user:${userId}` : ''}`;

    const cached = await this.cacheService.getValidatedCache().get(cacheKey);
    if (cached) return cached;

    // Build conditions array for OrganizationTable only
    const conditions: SQL<unknown>[] = [];

    if (search) {
      conditions.push(like(OrganizationTable.orgName, `%${search}%`));
    }

    if (isVerified !== undefined) {
      conditions.push(eq(OrganizationTable.isVerified, isVerified));
    }

    let organizations;

    // If filtering by userId, use join query
    if (userId) {
      const result = await this.dbService.getDb()
        .select()
        .from(OrganizationTable)
        .innerJoin(
          OrganizationUserSettingsTable,
          eq(OrganizationTable.id, OrganizationUserSettingsTable.organizationId)
        )
        .where(
          and(
            eq(OrganizationUserSettingsTable.userId, userId),
            conditions.length > 0 ? and(...conditions) : undefined
          )
        );

      // Extract just the organization objects from the join result
      organizations = result.map(row => row.organizations);
    } else {
      // No join needed
      organizations = await this.dbService.getDb()
        .select()
        .from(OrganizationTable)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
    }

    await this.cacheService.getValidatedCache().set(cacheKey, organizations, 300);
    return organizations;
  };

  // Create an organization
  create = async (
    data: CreateOrganizationDto,
    imageFile: Express.Multer.File,
    user: User,
    orgId: string,
  ) => {
    const { orgName, orgDescription, orgSlug } = data;

    // Get user's active subscription
    const [userSubscription] = await this.dbService.getDb()
      .select()
      .from(UserSubscriptionsTable)
      .where(eq(UserSubscriptionsTable.userId, user.id))
      .orderBy(desc(UserSubscriptionsTable.createdAt))
      .limit(1);

    if (!this.appPermissionService.hasPermission(user, orgId, 'OWNER')) {
      throw new ForbiddenException(
        'You do not have permission to create organizations',
      );
    }

    // Check if user has an active subscription
    if (!userSubscription || !this.subscriptionPermissionsService.isSubscriptionActive(userSubscription)) {
      throw new ForbiddenException(
        'An active subscription is required. Please check your subscriptions',
      );
    }

    // Count current organizations owned by user
    const userOrganizations = await this.dbService.getDb()
      .select()
      .from(OrganizationUserSettingsTable)
      .where(
        and(
          eq(OrganizationUserSettingsTable.userId, user.id),
          eq(OrganizationUserSettingsTable.role, 'OWNER'),
        ),
      );

    const currentOrgCount = userOrganizations.length;

    // Check against subscription plan limit
    // Assuming you add 'organizations' to your action types
    if (!this.subscriptionPermissionsService.canPerformAction(
      userSubscription,
      'organizations',
      currentOrgCount,
    )) {
      const plans = getSubscriptionPlans();
      const limit = plans[userSubscription.planName].limits.organizations;
      throw new ForbiddenException(
        `You have reached the maximum limit of ${limit} organizations for your ${userSubscription.planName} plan. Upgrade to create more organizations.`,
      );
    }

    // Check if organization with same orgName or slug already exists
    const existingOrg = await this.dbService.getDb()
      .select()
      .from(OrganizationTable)
      .where(
        or(
          eq(OrganizationTable.orgName, orgName),
          eq(OrganizationTable.slug, orgSlug),
        ),
      )
      .limit(1);

    if (existingOrg.length > 0) {
      if (existingOrg[0].orgName === orgName) {
        throw new ConflictException('Organization name already exists');
      }
      if (existingOrg[0].slug === orgSlug) {
        throw new ConflictException('Organization slug already taken');
      }
    }

    const { key: imageKey, url: imageUrl } =
      await this.s3Service.s3().uploadFileAndGetUrl(
        imageFile,
        'organizations',
        'logos',
      );

    try {
      let organization;

      try {
        // Create organization
        [organization] = await this.dbService.getDb()
          .insert(OrganizationTable)
          .values({
            orgName,
            imageUrl,
            description: orgDescription,
            slug: orgSlug,
            membersCount: 1,
          })
          .returning();
      } catch (dbError: any) {
        // Cleanup uploaded file if database insert fails
        await this.s3Service.s3().deleteFile(imageKey);

        // Handle unique constraint violation
        if (dbError.code === '23505') {
          if (dbError.constraint?.includes('orgName')) {
            throw new ConflictException('Organization name already exists');
          }
          if (dbError.constraint?.includes('slug')) {
            throw new ConflictException('Organization slug already taken');
          }
        }
        throw dbError;
      }

      try {
        // Assign the creator as an owner of the organization
        await this.dbService.getDb().insert(OrganizationUserSettingsTable).values({
          userId: user.id,
          organizationId: organization.id,
          newApplicationEmailNotifications: false,
          role: 'OWNER',
        });
      } catch (settingsError: any) {
        // Rollback: Delete the organization we just created
        await this.dbService.getDb()
          .delete(OrganizationTable)
          .where(eq(OrganizationTable.id, organization.id));

        // Delete the uploaded image
        await this.s3Service.s3().deleteFile(imageKey);

        this.logger.error(
          `Failed to create organization user settings: ${settingsError?.message ?? settingsError}`,
        );
        throw new InternalServerErrorException(
          'Failed to complete organization creation. Please try again',
        );
      }

      this.logger.log(
        `Organization created with ID: ${organization.id} and assigned to user: ${user.id}. Subscription: ${userSubscription.planName}`,
      );

      return organization;
    } catch (error) {
      // Final cleanup for any uncaught errors
      this.logger.warn(`Operation failed. Deleting orphaned file: ${imageKey}`);
      await this.s3Service.s3()
        .deleteFile(imageKey)
        .catch((e) =>
          this.logger.error(`Failed to delete ${imageKey}: ${e.message}`),
        );
      throw error;
    }
  };

  // Get organizations by user ID
  findByUser = async (userId: string) => {
    if (!userId) {
      this.logger.error('Missing userId');
      throw new BadRequestException('No userId provided');
    }

    const [user] = await this.dbService.getDb()
      .select({ id: UserTable.id })
      .from(UserTable)
      .where(eq(UserTable.id, userId))
      .limit(1);

    if (!user) {
      this.logger.error(`User with id ${userId} not found`);
      throw new NotFoundException('User not found');
    }

    const orgs = await this.dbService.getDb()
      .select()
      .from(OrganizationTable)
      .innerJoin(
        OrganizationUserSettingsTable,
        eq(OrganizationTable.id, OrganizationUserSettingsTable.organizationId),
      )
      .where(eq(OrganizationUserSettingsTable.userId, userId));

    if (!orgs || orgs.length === 0) {
      throw new NotFoundException(
        'No organizations found. Please consider creating one',
      );
    }

    // Extract only the organization data from the join result
    const organizations = orgs.map((item) => item.organizations);

    return organizations;
  };

  // Get a single organization by ID
  findOne = async (orgId: string) => {
    if (!orgId) {
      this.logger.error('Missing orgId');
      throw new BadRequestException('No orgId provided');
    }

    const [org] = await this.dbService.getDb()
      .select()
      .from(OrganizationTable)
      .where(eq(OrganizationTable.id, orgId))
      .limit(1);

    if (!org) {
      this.logger.error(`Organization with ID ${orgId} not found`);
      throw new NotFoundException(
        'No organizations found. Please consider creating one',
      );
    }

    return org;
  };

  // Get selected organization by ID
  findSelected = async (orgId: string) => {
    if (!orgId) {
      this.logger.error('Missing orgId');
      throw new BadRequestException('No orgId provided');
    }

    const [org] = await this.dbService.getDb()
      .select()
      .from(OrganizationTable)
      .where(eq(OrganizationTable.id, orgId))
      .limit(1);

    if (!org) {
      this.logger.error(`Organization with ID ${orgId} not found`);
      throw new NotFoundException(
        'No organizations found. Please consider creating one',
      );
    }

    return org;
  };

  update = async (
    user: User,
    dto: UpdateOrganizationDto,
    orgId: string,
    imageFile?: Express.Multer.File,
  ) => {
    if (!this.appPermissionService.hasPermission(user, null, Permissions.UPDATE_ORG)) {
      throw new UnauthorizedException("You cannot update this org's data")
    }

    const { orgName, description, slug } = dto;

    if (!orgId) {
      throw new BadRequestException('User is not associated with an organization');
    }

    // Variable to track uploaded image for cleanup
    let uploadedImageKey: string | undefined | null;

    try {
      // Check if orgName is being updated and if it's already taken
      if (orgName) {
        const existingOrg = await this.dbService.getDb()
          .select()
          .from(OrganizationTable)
          .where(
            and(
              eq(OrganizationTable.orgName, orgName),
              not(eq(OrganizationTable.id, orgId)),
            ),
          )
          .limit(1);

        if (existingOrg.length > 0) {
          throw new ConflictException('Organization name already exists');
        }
      }

      // Build update object with only provided fields
      const updateData: Partial<typeof OrganizationTable.$inferInsert> = {};

      if (orgName !== undefined) updateData.orgName = orgName;
      if (description !== undefined) updateData.description = description;
      if (slug !== undefined) updateData.slug = slug;

      // Handle image upload if provided
      let oldImageUrl: string | undefined | null;

      if (imageFile) {
        // Get the current image URL to delete later
        const [currentOrg] = await this.dbService.getDb()
          .select({ imageUrl: OrganizationTable.imageUrl })
          .from(OrganizationTable)
          .where(eq(OrganizationTable.id, orgId))
          .limit(1);

        oldImageUrl = currentOrg?.imageUrl;

        // Upload new image
        const { key, url } = await this.s3Service.s3().uploadFileAndGetUrl(
          imageFile,
          'organizations',
          'logos',
        );

        uploadedImageKey = key;
        updateData.imageUrl = url;
      }

      // Only proceed if there's data to update
      if (Object.keys(updateData).length === 0) {
        throw new BadRequestException('No fields to update');
      }

      // Perform the update
      const [updatedOrg] = await this.dbService.getDb()
        .update(OrganizationTable)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(OrganizationTable.id, orgId))
        .returning();

      if (!updatedOrg) {
        // Cleanup uploaded file if update failed
        if (uploadedImageKey) {
          await this.s3Service.s3().deleteFile(uploadedImageKey);
        }
        throw new NotFoundException('Organization not found'); // Fixed: was "User not found"
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
            `Failed to delete old image for organization ${orgId}: ${deleteError}`,
          );
        }
      }

      return updatedOrg;
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
      this.logger.error(`Failed to update organization ${orgId}:`, error);
      throw error;
    }
  };
}
