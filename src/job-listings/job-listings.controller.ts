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
import { CurrentUser } from '@/decorators/current-user.decorator';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

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
    @CurrentUser() user: any,
    @Query('search') search?: string,
    @Query('organizationId') organizationId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('locationRequirement') locationRequirement?: string,
    @Query('experienceLevel') experienceLevel?: string,
  ) {
    try {
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
        data: {
          jobListings,
        },
        statusCode: 200
      }
    } catch (error) {
      throw error
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
    @CurrentUser() user: any,
  ) {
    try {
      const jobListing = await this.jobListingsService.create(createJobListingDto, user.id);

      return {
        message: 'Job created successfully',
        data: {
          jobListings: [jobListing],
        },
        statusCode: 201
      };
    } catch (error) {
      throw error
    }
  }
}
