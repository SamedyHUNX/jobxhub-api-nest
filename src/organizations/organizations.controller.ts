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
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { OrganizationsService } from './services/organizations.service';
import { JwtAuthGuard } from '@/auth/jwt/jwt.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { MulterExceptionFilter } from '@/utils/multer-global-handling';
import { CreateOrganizationDto } from './dtos/create-organization.dto';
import { CurrentUser } from '@/decorators/current-user.decorator';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IdValidationPipe, ImageValidationPipe } from '@/utils/pipes/image-validation-pipe';
import { SelectedOrgId } from '@/decorators/select-org-id.decorator';
import type { User } from '@/types';
import { UpdateOrganizationDto } from './dtos/update-organization.dto';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) { }

  // Create a new organization: POST /organizations
  @Post()
  @ApiOperation({ summary: 'Create an organization' })
  @ApiResponse({ status: 200, description: 'Create an organization' })
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
          return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
      },
    }),
  )
  @UseFilters(MulterExceptionFilter)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createOrganizationDto: CreateOrganizationDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
    @SelectedOrgId() orgId: string,
  ) {
    await this.orgsService.create(createOrganizationDto, file, user, orgId);

    return {
      statusCode: 200,
      message: 'Organization created successfully',
      data: []
    };
  }

  // Get all organizations with optional filtering: GET /organizations?search=name&isVerified=true
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @CurrentUser() user: User,
    @Query('search') search?: string,
    @Query('isVerified') isVerified?: string,
  ) {
    const isVerifiedBool =
      isVerified === 'true' ? true : isVerified === 'false' ? false : undefined;

    const allOrganizations = await this.orgsService.findAll(
      user,
      search,
      isVerifiedBool
    );

    return {
      message: 'Organizations fetched successfully',
      data: allOrganizations,
      statusCode: 200
    };
  }

  // Get organizations by user ID: GET /organizations/user/:userId
  @Get('user/:userId')
  async findByUser(@Param('userId', IdValidationPipe) userId: string) {
    const orgs = await this.orgsService.findByUser(userId);

    return {
      data: {
        orgs,
      },
    };
  }

  @Put('org/:orgId')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @CurrentUser() user: User,
    @Body() updatedOrgDto: UpdateOrganizationDto,
    @Param('orgId', IdValidationPipe) orgId: string,
    @UploadedFile(new ImageValidationPipe()) imageFile?: Express.Multer.File,
  ) {
    const org = await this.orgsService.update(user, updatedOrgDto, orgId, imageFile);

    return {
      data: {
        orgs: org,
      },
    };
  }

}
