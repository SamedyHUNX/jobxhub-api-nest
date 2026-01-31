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
import { CurrentUser } from '../decorators/current-user.decorator';
import { plainToInstance } from 'class-transformer';
import { UserResponseDto } from '@/users/dtos/user-response.dto';
import type { Response } from 'express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  // Sign Up (/api/auth/signup)
  @Post('sign-up')
  @HttpCode(200)
  @ApiOperation({ summary: 'Create a user' })
  @ApiResponse({ status: 200, description: 'Create a user' })
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async signUp(
    @Body() data: SignUpDto,
    @UploadedFile(new ImageValidationPipe()) image: Express.Multer.File,
    @Headers('accept-language') acceptLanguage: string,
    @Res() res: Response,
  ) {
    const result = await this.authService.signUp(data, image, acceptLanguage);
    return res.status(200).json(result);
  }


  // Verify Email (/api/auth/verify-email)
  @ApiOperation({ summary: 'Verify email' })
  @ApiResponse({ status: 201, description: 'Verify email' })
  @HttpCode(201)
  @Post('verify-email')
  async verifyEmail(@Body('token') token: string, @Res() res: Response) {
    try {
      await this.authService.verifyEmail(token);
      return res.status(201).send();
    } catch (error) {
      throw error;
    }
  }

  // Sign In (/api/auth/signin)
  @ApiOperation({ summary: 'Sign in' })
  @ApiResponse({ status: 200, description: 'Sign in' })
  @HttpCode(200)
  @Post('sign-in')
  async signIn(
    @Body() data: SignInDto,
    @Res() res: Response,
    @Ip() ipAddress: string,
    @CurrentUser() user: any,
  ) {
    const token = await this.authService.signIn(data, ipAddress, user);

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
  @ApiOperation({ summary: 'Get current user' })
  @ApiResponse({ status: 200, description: 'Get current user' })
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(ClassSerializerInterceptor)
  getMe(@CurrentUser() user: any) {
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  // POST forgot-password
  @ApiOperation({ summary: 'Forgot password' })
  @ApiResponse({ status: 200, description: 'Forgot password' })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(
    @Body() { email }: RequestPasswordResetDto,
    @Headers('accept-language') acceptLanguage: string,
    @Ip() ipAddress: string,
  ) {
    return this.authService.forgotPassword(email, acceptLanguage, ipAddress);
  }

  @ApiOperation({ summary: 'Reset password' })
  @ApiResponse({ status: 200, description: 'Reset password' })
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

  @ApiOperation({ summary: 'Sign out' })
  @ApiResponse({ status: 200, description: 'Sign out' })
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
