import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JobListingsService } from './job-listings.service';
import { JwtAuthGuard } from '@/auth/jwt/jwt.guard';
import { CreateJobListingDto } from './dtos/job-listings.dto';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';

@Controller('job-listings')
export class JobListingsController {
  constructor(private readonly jobListingsService: JobListingsService) { }

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

  // Get all job listings: GET /job-listings
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query('search') search?: string,
    @Query('organizationId') organizationId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('locationRequirement') locationRequirement?: string,
    @Query('experienceLevel') experienceLevel?: string,
  ) {
    return this.jobListingsService.findAll(
      search,
      organizationId,
      status,
      type,
      locationRequirement,
      experienceLevel,
    );
  }
}
