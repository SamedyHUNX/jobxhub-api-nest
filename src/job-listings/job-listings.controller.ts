import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JobListingsService } from './job-listings.service';
import { JwtAuthGuard } from '@/auth/jwt/jwt.guard';
import { CreateJobListingDto } from './dtos/job-listings.dto';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';

@Controller('job-listings')
export class JobListingsController {
  constructor(private readonly jobListingsService: JobListingsService) {}

  // Create a new job listing: POST /job-listings
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createJobListingDto: CreateJobListingDto,
    @CurrentUser() user: any,
  ) {
    return this.jobListingsService.create(createJobListingDto, user.id);
  }
}
