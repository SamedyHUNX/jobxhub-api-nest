import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { S3Module } from '@/s3/s3.module';
import { OrganizationsService } from './organizations.service';
import { InngestModule } from '@/inngest/inngest.module';
import { CommonModule } from '@/common/common.module';
import { CacheModule } from '@/cache/cache.module';
import { PermissionsModule } from '@/permissions/permissions.module';

@Module({
  imports: [S3Module, InngestModule, CommonModule, CacheModule, PermissionsModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule { }
