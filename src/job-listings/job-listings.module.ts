import { Module } from '@nestjs/common';
import { JobListingsService } from './job-listings.service';
import { JobListingsController } from './job-listings.controller';
import { CommonModule } from '@/common/common.module';
import { PermissionsModule } from '@/permissions/permissions.module';

@Module({
  imports: [CommonModule, PermissionsModule],
  controllers: [JobListingsController],
  providers: [JobListingsService],
})
export class JobListingsModule { }
