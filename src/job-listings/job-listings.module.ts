import { Module } from '@nestjs/common';
import { JobListingsService } from './services/job-listings.service';
import { JobListingsController } from './job-listings.controller';
import { CommonModule } from '@/common/common.module';
import { PermissionsModule } from '@/permissions/permissions.module';
import { InngestModule } from '@/inngest/inngest.module';

@Module({
  imports: [CommonModule, PermissionsModule, InngestModule],
  controllers: [JobListingsController],
  providers: [JobListingsService],
})
export class JobListingsModule { }
