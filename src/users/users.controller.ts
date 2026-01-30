import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '@/auth/jwt/jwt.guard';
import { UpdatedMeDataDto } from './dtos/update-me.dto';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImageValidationPipe } from '@/utils/image-validation-pipe';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @ApiOperation({ summary: 'Update current user' })
  @ApiResponse({ status: 200, description: 'Update current user' })
  @Put('/me')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )

  @ApiResponse({ status: 200, description: 'Update current user' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  @UseInterceptors(ClassSerializerInterceptor)
  updateMe(
    @CurrentUser() user: any,
    @Body() updatedMeData: UpdatedMeDataDto,
    @UploadedFile(new ImageValidationPipe())
    image?: Express.Multer.File,
  ) {
    return this.usersService.updateMe(user.id, updatedMeData, image);
  }
}
