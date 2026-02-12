import { Module } from '@nestjs/common';
import { JobListingsService } from './services/job-listings.service';
import { JobListingsController } from './job-listings.controller';
import { CommonModule } from '@/common/common.module';
import { PermissionsModule } from '@/permissions/permissions.module';
import { JobListingsUtilsService } from './services/job-listings-utils.service';

@Module({
  imports: [CommonModule, PermissionsModule],
  controllers: [JobListingsController],
  providers: [JobListingsService, JobListingsUtilsService],
})
export class JobListingsModule { }
