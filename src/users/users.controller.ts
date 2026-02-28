import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Patch,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '@/auth/jwt/jwt.guard';
import { UpdatedMeDataDto } from './dtos/update-me.dto';
import { CurrentUser } from '@/decorators/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImageValidationPipe } from '@/utils/pipes/image-validation-pipe';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { User } from '@/types';
import { UpdateNotificationSettingsDto } from './dtos/update-notification-settings.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  // GET ALL USERS /api/users
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'Get all users' })
  @Get()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(ClassSerializerInterceptor)
  async getAllUsers(@CurrentUser() user: User) {
    const users = await this.usersService.getAll(user);

    if (!users) {
      return {
        statusCode: 404,
        message: 'Users not found',
        data: []
      }
    }

    return {
      statusCode: 200,
      message: 'Get all users successfully',
      data: users
    }
  }

  // PUT /api/users/me
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
  async updateMe(
    @CurrentUser() user: User,
    @Body() updatedMeData: UpdatedMeDataDto,
    @UploadedFile(new ImageValidationPipe())
    image?: Express.Multer.File,
  ) {
    const updatedUserData = await this.usersService.update(user, updatedMeData, image);

    if (updatedUserData) {
      return {
        statusCode: 200,
        message: 'User updated successfully',
        data: [updatedUserData]
      };
    }
    return {
      statusCode: 404,
      message: 'Failed to update user',
      data: []
    }
  }

  // Get user notification settings
  @ApiOperation({ summary: 'Get user notification settings' })
  @ApiResponse({ status: 200, description: 'Get user notification settings' })
  @Get('/me/notification-settings')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(ClassSerializerInterceptor)
  async getNotificationSettings(@CurrentUser() user: User) {
    const notificationSettings = await this.usersService.getNotificationSettings(user);

    return {
      statusCode: 200,
      message: 'Get notification settings successfully',
      data: [notificationSettings]
    }
  }

  // Update notification settings
  @ApiOperation({ summary: 'Update notification settings' })
  @ApiResponse({ status: 200, description: 'Update notification settings' })
  @Patch('/me/notification-settings')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(ClassSerializerInterceptor)
  async updateNotificationSettings(@CurrentUser() user: User, @Body() updateNotificationSettingsDto: UpdateNotificationSettingsDto) {
    console.log('data received', updateNotificationSettingsDto)
    const notificationSettings = await this.usersService.updateNotificationSettings(user, updateNotificationSettingsDto);

    return {
      statusCode: 200,
      message: 'Update notification settings successfully',
      data: [notificationSettings]
    }
  }
}
