import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  RequestPasswordResetDto,
  ResetPasswordDto,
  SignInDto,
  SignUpDto,
} from './dtos/auth.dto';
import { ImageValidationPipe } from '@/utils/image-validation-pipe';
import { JwtAuthGuard } from './jwt/jwt.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { plainToInstance } from 'class-transformer';
import { UserResponseDto } from '@/users/dtos/user-response.dto';
import type { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Sign Up (/api/auth/signup)
  @Post('sign-up')
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

  // Verify Email (/api/auth/verify-email)
  @Post('verify-email')
  verifyEmail(@Body('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  // Sign In (/api/auth/signin)
  @Post('sign-in')
  async signIn(
    @Body() data: SignInDto,
    @Res() res: Response,
    @Ip() ipAddress: string,
  ) {
    const { token } = await this.authService.signIn(data, ipAddress);

    // Set HttpOnly Secure SameSite cookie
    res.cookie('access_token', token, {
      httpOnly: true, // Not accessible via JavaScript
      secure: process.env.NODE_ENV === 'production', // Only sent over HTTPS
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Sent with cross-site requests
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/', // Available across the entire site
    });

    // Return user info without exposing token
    return res.json({
      status: 'success',
      message: 'Signed in successfully',
      code: 200,
    });
  }

  // Get current user (/api/auth/me)
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(ClassSerializerInterceptor)
  getMe(@CurrentUser() user: any) {
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  // POST forgot-password
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(
    @Body() { email }: RequestPasswordResetDto,
    @Headers('accept-language') acceptLanguage: string,
    @Ip() ipAddress: string,
  ) {
    return this.authService.forgotPassword(email, acceptLanguage, ipAddress);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() { token, newPassword, confirmNewPassword }: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(
      token,
      newPassword,
      confirmNewPassword,
    );
  }

  @Post('sign-out')
  @UseGuards(JwtAuthGuard)
  async signOut(@Res() res: Response, @CurrentUser() user: any) {
    await this.authService.signOut(user.id);

    // Clear the cookie
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    });

    return res.json({
      message: 'Signed out successfully',
    });
  }
}
