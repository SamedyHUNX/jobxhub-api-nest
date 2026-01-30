import { ConfigService } from '@/config/config.service';
import { DrizzleService } from '@/drizzle/services/drizzle.service';
import { S3Service } from '@/s3/services/s3.service';
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
import { and, eq, like, or } from 'drizzle-orm';
import { InngestHealthService } from '@/inngest/services/inngest-health.service';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private dbService: DrizzleService,
    private s3Service: S3Service,
    private readonly configService: ConfigService,
    private inngestHealth: InngestHealthService,
  ) {}

  private get redisCache() {
    if (!this.cacheManager) {
      const message = `Redis server is down at ${this.getTimestamp()}`;
      this.logger.error(message);
      Sentry.captureException(new Error(message));
      throw new InternalServerErrorException('Cache service unavailable');
    }
    return this.cacheManager;
  }

  private get inngest() {
    return this.inngestHealth.getInngest();
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

  // Get all orgs with optional filtering
  findAll = async (search?: string, isVerified?: boolean) => {
    const cacheKey = `orgs:all${search ? `:search:${search}` : ''}${isVerified !== undefined ? `:verified:${isVerified}` : ''}`;

    const cached = await this.redisCache.get(cacheKey);
    if (cached) return cached;

    const baseQuery = this.dbServer.select().from(OrganizationTable);

    let organizations;

    if (search && isVerified !== undefined) {
      organizations = await baseQuery.where(
        and(
          like(OrganizationTable.orgName, `%${search}%`),
          eq(OrganizationTable.isVerified, isVerified),
        ),
      );
    } else if (search) {
      organizations = await baseQuery.where(
        like(OrganizationTable.orgName, `%${search}%`),
      );
    } else if (isVerified !== undefined) {
      organizations = await baseQuery.where(
        eq(OrganizationTable.isVerified, isVerified),
      );
    } else {
      organizations = await baseQuery;
    }

    const result = {
      message: 'Organizations fetched successfully',
      data: { organizations },
    };

    await this.redisCache.set(cacheKey, result, 300); // 5 min (300 seconds)
    return result;
  };

  // Create an organization
  create = async (
    data: CreateOrganizationDto,
    imageFile: Express.Multer.File,
    userId: string,
  ) => {
    const { orgName, slug } = data;

    // Check if organization with same orgName or slug already exists
    const existingOrg = await this.dbServer
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
      await this.s3Server.uploadFileAndGetUrl(
        imageFile,
        'organizations',
        'logos',
      );

    try {
      let organization;

      try {
        // Create organization
        [organization] = await this.dbServer
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
        await this.s3Server.deleteFile(imageKey);

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
        await this.dbServer.insert(OrganizationUserSettingsTable).values({
          userId,
          organizationId: organization.id,
          newApplicationEmailNotifications: false,
        });
      } catch (settingsError: any) {
        // Rollback: Delete the organization we just created
        await this.dbServer
          .delete(OrganizationTable)
          .where(eq(OrganizationTable.id, organization.id));

        // Delete the uploaded image
        await this.s3Server.deleteFile(imageKey);

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

      return {
        message: 'Organization created successfully',
        data: {
          organizations: organization,
        },
      };
    } catch (error) {
      // Final cleanup for any uncaught errors
      this.logger.warn(`Operation failed. Deleting orphaned file: ${imageKey}`);
      await this.s3Server
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

    const [user] = await this.dbServer
      .select({ id: UserTable.id })
      .from(UserTable)
      .where(eq(UserTable.id, userId))
      .limit(1);

    if (!user) {
      this.logger.error(`User with id ${userId} not found`);
      throw new NotFoundException('User not found');
    }

    const orgs = await this.dbServer
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

    return {
      message: 'Organizations fetched successfully',
      data: {
        organizations,
      },
    };
  };

  // Get a single organization by ID
  findOne = async (orgId: string) => {
    if (!orgId) {
      this.logger.error('Missing orgId');
      throw new BadRequestException('No orgId provided');
    }

    const [org] = await this.dbServer
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

    return {
      message: 'Organizations fetched successfully',
      data: {
        organizations: org,
      },
    };
  };
}
