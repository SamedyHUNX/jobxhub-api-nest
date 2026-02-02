import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '@/auth/jwt/jwt.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { MulterExceptionFilter } from '@/utils/multer-global-handling';
import { CreateOrganizationDto } from './dtos/organizations.dto';
import { CurrentUser } from '@/decorators/current-user.decorator';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IdValidationPipe } from '@/utils/image-validation-pipe';
import { SelectedOrgId } from '@/decorators/select-org-id.decorator';

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
    @CurrentUser() user: any,
  ) {
    await this.orgsService.create(createOrganizationDto, file, user.id);

    return {
      statusCode: 201,
      message: 'Organization created successfully',
      data: []
    };
  }

  // Get all organizations with optional filtering: GET /organizations?search=name&isVerified=true
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @CurrentUser() user: any,
    @Query('search') search?: string,
    @Query('isVerified') isVerified?: string,
  ) {
    const isVerifiedBool =
      isVerified === 'true' ? true : isVerified === 'false' ? false : undefined;

    try {
      const allOrganizations = await this.orgsService.findAll(user.id, search, isVerifiedBool);

      if (!allOrganizations) {
        throw new NotFoundException('Organizations not found');
      }

      return {
        message: 'Organizations fetched successfully',
        data: allOrganizations,
        statusCode: 200
      };
    } catch (error) {
      throw error
    }
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

  // Get selected organization by ID: GET /organizations/selected
  @Get('org/selected')
  async findSelected(@SelectedOrgId() orgId: string) {
    const org = await this.orgsService.findSelected(orgId);

    return {
      data: {
        orgs: org,
      },
    };
  }

  // Get a single organization by ID: GET /organizations/:id
  @Get('org/:id')
  async findOne(@Param('id', IdValidationPipe) id: string) {
    const org = await this.orgsService.findOne(id);

    return {
      data: {
        orgs: org,
      },
    };
  }
}
