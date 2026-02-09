import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JobListingsService } from './job-listings.service';
import { JwtAuthGuard } from '@/auth/jwt/jwt.guard';
import { CreateJobListingDto, UpdateJobListingDto } from './dto/job-listings.dto';
import { CurrentUser } from '@/decorators/current-user.decorator';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { User } from '@/types';
import { SelectedOrgId } from '@/decorators/select-org-id.decorator';

@ApiTags('job-listings')
@Controller('job-listings')
@ApiBearerAuth()
export class JobListingsController {
  constructor(private readonly jobListingsService: JobListingsService) { }

  // Get all job listings: GET /job-listings
  @Get()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async findAll(
    @CurrentUser() user: User,
    @Query('search') search?: string,
    @Query('organizationId') organizationId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('locationRequirement') locationRequirement?: string,
    @Query('experienceLevel') experienceLevel?: string,
  ) {
    const jobListings = await this.jobListingsService.findAll(
      search,
      organizationId,
      status,
      type,
      locationRequirement,
      experienceLevel,
      user.id
    );

    return {
      message: 'Job listings fetched successfully',
      data: jobListings,
      statusCode: 200
    }
  }

  // Get a job listing based on Id: GET /job-listings/:id
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async findOne(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @SelectedOrgId() orgId: string,
  ) {
    const jobListings = await this.jobListingsService.findOne(
      id,
      user.id,
      orgId
    );

    return {
      message: 'Job listings fetched successfully',
      data: [jobListings],
      statusCode: 200
    }
  }

  // Create a new job listing: POST /job-listings
  @ApiOperation({ summary: 'Create a new job listing' })
  @ApiResponse({ status: 201, description: 'Job listing created successfully' })
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createJobListingDto: CreateJobListingDto,
    @CurrentUser() user: User,
    @SelectedOrgId() orgId: string,
  ) {
    const jobListing = await this.jobListingsService.create(createJobListingDto, user.id, orgId);

    return {
      message: 'Job created successfully',
      data: {
        jobListings: [jobListing],
      },
      statusCode: 201
    };
  }

  // Update a job listing: PUT /job-listings/:jobId
  @Put('/:jobId')
  @UseGuards(JwtAuthGuard)
  async update(
    @Body() updateJobListingDto: UpdateJobListingDto,
    @CurrentUser() user: User,
    @SelectedOrgId() orgId: string,
    @Param('jobId') jobId: string
  ) {
    const success = await this.jobListingsService.update(
      user,
      orgId,
      jobId,
      updateJobListingDto,
    );

    if (success) {
      return {
        message: 'Job listing updated successfully',
        data: [],
        statusCode: 200,
      };
    }
  }

}
