import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
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
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IdValidationPipe } from '@/utils/image-validation-pipe';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  // Create a new organization: POST /organizations
  @Post('/create')
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
    return this.orgsService.create(createOrganizationDto, file, user.id);
  }

  // Get all organizations with optional filtering: GET /organizations?search=name&isVerified=true
  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('isVerified') isVerified?: string,
  ) {
    const isVerifiedBool =
      isVerified === 'true' ? true : isVerified === 'false' ? false : undefined;
    return this.orgsService.findAll(search, isVerifiedBool);
  }

  // Get organizations by user ID: GET /organizations/user/:userId
  @Get('user/:userId')
  async findByUser(@Param('userId', IdValidationPipe) userId: string) {
    return this.orgsService.findByUser(userId);
  }

  //Get a single organization by ID: GET /organizations/:id
  @Get('org/:id')
  async findOne(@Param('id', IdValidationPipe) id: string) {
    return this.orgsService.findOne(id);
  }
}
