import { ConfigService } from '@/config/config.service';
import { DrizzleService } from '@/drizzle/drizzle.service';
import { InngestClientService } from '@/inngest/inngest.service';
import { S3Service } from '@/s3/s3.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { CreateOrganizationDto } from './dtos/organizations.dto';
import {
  OrganizationTable,
  OrganizationUserSettingsTable,
} from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private dbService: DrizzleService,
    private s3Service: S3Service,
    private readonly configService: ConfigService,
    private inngestService: InngestClientService,
  ) {}

  private get redisServer() {
    if (!this.cacheManager) {
      const message = `Redis server is down at ${this.getTimestamp()}`;
      this.logger.error(message);
      Sentry.captureException(new Error(message));
      throw new InternalServerErrorException('Cache service unavailable');
    }
    return this.cacheManager;
  }

  private get inngest() {
    if (!this.inngestService || !this.inngestService.inngest) {
      const message = `Inngest client is down at ${this.getTimestamp()}`;
      this.logger.error(message);
      Sentry.captureException(new Error(message));
      throw new InternalServerErrorException('Event service unavailable');
    }
    return this.inngestService.inngest;
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

  // Create an organization
  create = async (
    data: CreateOrganizationDto,
    file: Express.Multer.File,
    userId: string,
  ) => {
    const { orgName, slug } = data;

    // Check if organization with same orgName already exists
    const existingOrg = await this.dbServer
      .select()
      .from(OrganizationTable)
      .where(eq(OrganizationTable.orgName, orgName))
      .limit(1);

    if (existingOrg.length > 0) {
      this.logger.error(
        `Organization with orgName "${orgName}" already exists`,
      );
      throw new ConflictException('Organization already exists');
    }

    let imageUrl: string | undefined;
    let imageKey: string | undefined;

    // Upload image to S3 if provided
    if (file && file.originalname) {
      imageKey = `organizations/logos/${Date.now()}-${file.originalname}`;
      await this.s3Server.uploadFile(file, imageKey);
      imageUrl = `${process.env.R2_PUBLIC_DOMAIN}/${imageKey}`;
    }

    try {
      // Create organization
      const [organization] = await this.dbServer
        .insert(OrganizationTable)
        .values({
          orgName,
          imageUrl,
          slug,
        })
        .returning();

      // Assign the creator as a member of the organization
      await this.dbServer.insert(OrganizationUserSettingsTable).values({
        userId,
        organizationId: organization.id,
        newApplicationEmailNotifications: false,
      });

      this.logger.log(
        `Organization created with ID: ${organization.id} and assigned to user: ${userId}`,
      );

      return {
        message: 'Organization created successfully',
        data: {
          organization,
        },
      };
    } catch (error) {
      // If database insertion fails, delete the uploaded file from S3
      if (imageKey) {
        this.logger.warn(
          `Database insertion failed. Deleting orphaned file: ${imageKey}`,
        );
        try {
          await this.s3Server.deleteFile(imageKey);
        } catch (s3Error: any) {
          // Opt to not alert the user
          this.logger.error(
            `Failed to delete orphaned file ${imageKey}: ${s3Error.message}`,
          );
        }
      }
      throw error;
    }
  };
}
