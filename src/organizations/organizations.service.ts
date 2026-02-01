import { ConfigService } from '@/common/services/config.service';
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
import * as Sentry from '@sentry/nestjs';
import { CreateOrganizationDto } from './dtos/organizations.dto';
import {
  OrganizationTable,
  OrganizationUserSettingsTable,
  UserTable,
} from '@/drizzle/schema';
import type { Cache } from 'cache-manager';
import { and, eq, like, or, SQL } from 'drizzle-orm';
import { InngestHealthService } from '@/inngest/services/inngest-health.service';
import { DrizzleHealthService } from '@/drizzle/services/drizzle-health.service';
import { S3HealthService } from '@/s3/services/s3-health.service';
import { CacheHealthService } from '@/cache/services/cache-health.service';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private dbHealth: DrizzleHealthService,
    private s3Health: S3HealthService,
    private readonly configService: ConfigService,
    private inngestHealth: InngestHealthService,
    private cacheHealth: CacheHealthService,
  ) { }

  private get cache() {
    return this.cacheHealth.getValidatedCache();
  }

  private get inngest() {
    return this.inngestHealth.getInngest();
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private get db() {
    return this.dbHealth.getDb();
  }

  private get s3() {
    return this.s3Health.getS3();
  }

  // Get all orgs with optional filtering
  findAll = async (search?: string, isVerified?: boolean, userId?: string) => {
    const cacheKey = `orgs:all${search ? `:search:${search}` : ''}${isVerified !== undefined ? `:verified:${isVerified}` : ''}${userId ? `:user:${userId}` : ''}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    // Build conditions array with explicit type
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
      conditions.push(eq(OrganizationUserSettingsTable.userId, userId));

      const result = await this.db
        .select()
        .from(OrganizationTable)
        .innerJoin(
          OrganizationUserSettingsTable,
          eq(OrganizationTable.id, OrganizationUserSettingsTable.organizationId)
        )
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      // Extract just the organization objects from the join result
      organizations = result.map(row => row.organizations);
    } else {
      // No join needed
      organizations = await this.db
        .select()
        .from(OrganizationTable)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
    }

    await this.cache.set(cacheKey, organizations, 300);
    return organizations;
  };

  // Create an organization
  create = async (
    data: CreateOrganizationDto,
    imageFile: Express.Multer.File,
    userId: string,
  ) => {
    const { orgName, slug } = data;

    // Check if organization with same orgName or slug already exists
    const existingOrg = await this.db
      .select()
      .from(OrganizationTable)
      .where(
        or(
          eq(OrganizationTable.orgName, orgName),
          eq(OrganizationTable.slug, slug),
        ),
      )
      .limit(1);

    if (existingOrg.length > 0) {
      if (existingOrg[0].orgName === orgName) {
        throw new ConflictException('Organization name already exists');
      }
      if (existingOrg[0].slug === slug) {
        throw new ConflictException('Organization slug already taken');
      }
    }

    const { key: imageKey, url: imageUrl } =
      await this.s3.uploadFileAndGetUrl(
        imageFile,
        'organizations',
        'logos',
      );

    try {
      let organization;

      try {
        // Create organization
        [organization] = await this.db
          .insert(OrganizationTable)
          .values({
            orgName,
            imageUrl,
            slug,
            createdBy: userId,
          })
          .returning();
      } catch (dbError: any) {
        // Cleanup uploaded file if database insert fails
        await this.s3.deleteFile(imageKey);

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
        // Assign the creator as a member of the organization
        await this.db.insert(OrganizationUserSettingsTable).values({
          userId,
          organizationId: organization.id,
          newApplicationEmailNotifications: false,
        });
      } catch (settingsError: any) {
        // Rollback: Delete the organization we just created
        await this.db
          .delete(OrganizationTable)
          .where(eq(OrganizationTable.id, organization.id));

        // Delete the uploaded image
        await this.s3.deleteFile(imageKey);

        this.logger.error(
          `Failed to create organization user settings: ${settingsError?.message ?? settingsError}`,
        );
        throw new InternalServerErrorException(
          'Failed to complete organization creation. Please try again',
        );
      }

      this.logger.log(
        `Organization created with ID: ${organization.id} and assigned to user: ${userId}`,
      );

      return organization;
    } catch (error) {
      // Final cleanup for any uncaught errors
      this.logger.warn(`Operation failed. Deleting orphaned file: ${imageKey}`);
      await this.s3
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

    const [user] = await this.db
      .select({ id: UserTable.id })
      .from(UserTable)
      .where(eq(UserTable.id, userId))
      .limit(1);

    if (!user) {
      this.logger.error(`User with id ${userId} not found`);
      throw new NotFoundException('User not found');
    }

    const orgs = await this.db
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

    const [org] = await this.db
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

    const [org] = await this.db
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
}
