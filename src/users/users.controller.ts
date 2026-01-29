import {
  Body,
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

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Put('/me')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  updateMe(
    @CurrentUser() user: any,
    @Body() updatedMeData: UpdatedMeDataDto,
    @UploadedFile(new ImageValidationPipe())
    image?: Express.Multer.File,
  ) {
    return this.usersService.updateMe(user.id, updatedMeData, image);
  }
}
