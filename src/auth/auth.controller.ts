import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Headers,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { SignInDto, SignUpDto } from './dtos/auth.dto';
import { ImageValidationPipe } from '@/utils/image-validation-pipe';
import { JwtAuthGuard } from './jwt/jwt.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { plainToInstance } from 'class-transformer';
import { UserResponseDto } from '@/users/dtos/user-response.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  signUp(
    @Body() data: SignUpDto,
    @UploadedFile(new ImageValidationPipe()) file: Express.Multer.File,
    @Headers('accept-language') acceptLanguage: string,
  ) {
    return this.authService.signUp(data, file, acceptLanguage);
  }
  @Post('verify-email')
  verifyEmail(@Body('token') token: string) {
    return this.authService.verifyEmail(token);
  }
  @Post('signin')
  signIn(@Body() data: SignInDto) {
    return this.authService.signIn(data);
  }
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(ClassSerializerInterceptor)
  getMe(@CurrentUser() user: any) {
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }
}
