import { Module } from '@nestjs/common';
import { JobListingsService } from './services/job-listings.service';
import { JobListingsController } from './job-listings.controller';
import { CommonModule } from '@/common/common.module';
import { PermissionsModule } from '@/permissions/permissions.module';
import { InngestModule } from '@/inngest/inngest.module';
import { S3Module } from '@/s3/s3.module';

@Module({
  imports: [CommonModule, PermissionsModule, InngestModule, S3Module],
  controllers: [JobListingsController],
  providers: [JobListingsService],
})
export class JobListingsModule { }
