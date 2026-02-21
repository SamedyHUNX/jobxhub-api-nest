import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JobListingsService } from './services/job-listings.service';
import { JwtAuthGuard } from '@/auth/jwt/jwt.guard';
import { CreateJobListingApplicationDto, CreateJobListingDto, UpdateJobListingDto } from './dto/job-listings.dto';
import { CurrentUser } from '@/decorators/current-user.decorator';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { User } from '@/types';
import { SelectedOrgId } from '@/decorators/select-org-id.decorator';
import { FileInterceptor } from '@nestjs/platform-express';

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
    @Query('title') title?: string,
    @Query('organizationId') organizationId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('locationRequirement') locationRequirement?: string,
    @Query('experience') experience?: string,
    @Query('city') city?: string,
    @Query('state') state?: string,
    @Query('jobIds') jobIds?: string | string[],
  ) {
    const jobListings = await this.jobListingsService.findAll(
      search,
      title,
      organizationId,
      status,
      type,
      locationRequirement,
      experience,
      city,
      state,
      jobIds
    );

    return {
      message: 'Job listings fetched successfully',
      data: jobListings,
      statusCode: 200
    }
  }

  // Get a job listing based on Id: GET /job-listings/:jobId
  @Get(':jobId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async findOne(
    @CurrentUser() user: User,
    @Param('jobId') jobId: string,
    @SelectedOrgId() orgId: string,
  ) {
    const jobListings = await this.jobListingsService.findOne(
      jobId,
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
    const jobListing = await this.jobListingsService.create(createJobListingDto, user, orgId);

    return {
      statusCode: 201,
      message: 'Job created successfully',
      data: {
        jobListings: [jobListing],
      },
    };
  }

  // Update a job listing: PUT /job-listings/:jobId
  @Put('/:jobId')
  @HttpCode(HttpStatus.OK)
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

  // Delete a job listing: DELETE /job-listings/:jobId
  @Delete('/:jobId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async delete(
    @CurrentUser() user: User,
    @SelectedOrgId() orgId: string,
    @Param('jobId') jobId: string
  ) {
    const success = await this.jobListingsService.delete(
      user,
      orgId,
      jobId,
    );

    if (success) {
      return {
        message: 'Job listing deleted successfully',
        data: [],
        statusCode: 200,
      };
    }
  }

  // Get job listing application
  @Get('/:jobId/application')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async getOwnJobListingApplication(
    @Param('jobId') jobId: string,
    @Query('userId') userId: string,
  ) {
    const application = await this.jobListingsService.getOwnJobListingApplication(
      userId,
      jobId,
    );

    return {
      message: 'Job listing application fetched successfully',
      data: application,
      statusCode: 200,
    };
  }

  // Create job listing application
  @Post('/:jobId/application')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async createJobListingApplication(
    @Param('jobId') jobId: string,
    @CurrentUser() user: User,
    @Body() createJobListingApplicationDto: CreateJobListingApplicationDto,
  ) {
    const application = await this.jobListingsService.createJobListingApplication(
      user.id,
      jobId,
      createJobListingApplicationDto,
    );

    return {
      message: 'Job listing application created successfully',
      data: application,
      statusCode: 200,
    };
  }

  // Upload resume
  @Post('/resume')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadResume(
    @CurrentUser() user: User,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: 'application/pdf' }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const resume = await this.jobListingsService.uploadResume(user.id, file);

    return {
      message: 'Resume uploaded successfully',
      data: [resume],
      statusCode: 200,
    };
  }

  // Get user resume
  @Get('/resume/:userId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async getUserResume(
    @Param('userId') userId: string,
  ) {
    const resume = await this.jobListingsService.getUserResume(userId);

    return {
      message: 'User resume fetched successfully',
      data: [resume],
      statusCode: 200,
    };
  }

  // Delete user resume
  @Delete('/resume/:userId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async deleteUserResume(
    @Param('userId') userId: string,
  ) {
    const success = await this.jobListingsService.deleteUserResume(userId);

    if (success) {
      return {
        message: 'User resume deleted successfully',
        data: [],
        statusCode: 200,
      };
    }
  }
}
