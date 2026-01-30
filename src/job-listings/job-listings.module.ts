import { Module } from '@nestjs/common';
import { JobListingsService } from './job-listings.service';
import { JobListingsController } from './job-listings.controller';

@Module({
  controllers: [JobListingsController],
  providers: [JobListingsService],
})
export class JobListingsModule {}
