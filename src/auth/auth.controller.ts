import {
  Body,
  Controller,
  Headers,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { SignUpDto } from './dtos/auth.dto';
import { ImageValidationPipe } from '@/utils/image-validation-pipe';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @UseInterceptors(FileInterceptor('image'))
  signUp(
    @Body() data: SignUpDto,
    @UploadedFile(new ImageValidationPipe()) file: Express.Multer.File,
    @Headers('accept-language') acceptLanguage: string,
  ) {
    return this.authService.signUp(data, file, acceptLanguage);
  }
}
