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
import { FileInterceptor } from '@nestjs/platform-express';
import {
  RequestPasswordResetDto,
  ResetPasswordDto,
  SignInDto,
  SignUpDto,
} from './dto/auth.dto';
import { ImageValidationPipe } from '@/utils/image-validation-pipe';
import { JwtAuthGuard } from './jwt/jwt.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { plainToInstance } from 'class-transformer';
import { UserResponseDto } from '@/users/dtos/user-response.dto';
import type { Response } from 'express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SignUpService } from './services/sign-up.service';
import { SignInService } from './services/sign-in.service';
import { VerifyEmailService } from './services/verify-email.service';
import { ForgotPasswordService } from './services/forgot-password.service';
import { ResetPasswordService } from './services/reset-password.service';
import { SignOutService } from './services/sign-out.service';
import type { User } from '@/types';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private signUpService: SignUpService, private signInService: SignInService, private verifyEmailService: VerifyEmailService, private forgotPasswordService: ForgotPasswordService, private resetPasswordService: ResetPasswordService, private signOutService: SignOutService) { }

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
    const success = await this.signUpService.signUp(data, image, acceptLanguage);
    if (success) {
      return res.json({
        statusCode: 200,
        message: 'User signed up successfully. Please verify your email.',
        data: [],
      });
    }

    return res.json({
      statusCode: 400,
      message: 'User sign up failed',
      data: [],
    });
  }


  // Verify Email (/api/auth/verify-email)
  @ApiOperation({ summary: 'Verify email' })
  @ApiResponse({ status: 200, description: 'Verify email' })
  @HttpCode(201)
  @Post('verify-email')
  async verifyEmail(@Body('token') token: string, @Res() res: Response) {
    const success = await this.verifyEmailService.verifyEmail(token);
    if (success) {
      return res.json({
        statusCode: 200,
        message: 'Email verified successfully',
        data: [],
      });
    }

    return res.json({
      statusCode: 400,
      message: 'Email verification failed',
      data: [],
    });
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
    const token = await this.signInService.signIn(data, ipAddress, user);
    if (!token) {
      return res.json({
        statusCode: 400,
        message: 'User sign in failed',
        data: [],
      });
    }
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
      message: 'Signed in successfully',
      data: [], // get data from getMe
      statusCode: 200,
    })
  }

  // Get current user (/api/auth/me)
  @ApiOperation({ summary: 'Get current user' })
  @ApiResponse({ status: 200, description: 'Get current user' })
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(ClassSerializerInterceptor)
  getMe(@CurrentUser() user: User) {
    const userData = plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });

    if (!userData) {
      return {
        statusCode: 404,
        message: 'User not found',
        data: [],
      };
    }

    return {
      statusCode: 200,
      message: 'User fetched successfully',
      data: [userData],
    };
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
    @Res() res: Response,
  ) {
    const success = await this.forgotPasswordService.forgotPassword(email, acceptLanguage, ipAddress);
    if (!success) {
      return res.json({
        statusCode: 400,
        message: 'Failed to send reset password email',
        data: [],
      });
    }
    return res.json({
      statusCode: 200,
      message: 'Reset password email sent successfully',
      data: [],
    })
  }

  @ApiOperation({ summary: 'Reset password' })
  @ApiResponse({ status: 200, description: 'Reset password' })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() { token, newPassword, confirmNewPassword }: ResetPasswordDto,
    @Res() res: Response,
  ) {
    const success = this.resetPasswordService.resetPassword(
      token,
      newPassword,
      confirmNewPassword,
    );
    if (!success) {
      return res.json({
        statusCode: 400,
        message: 'Failed to reset password',
        data: [],
      });
    }
    return res.json({
      statusCode: 200,
      message: 'Password reset successfully',
      data: [],
    })
  }

  @ApiOperation({ summary: 'Sign out' })
  @ApiResponse({ status: 200, description: 'Sign out' })
  @Post('sign-out')
  @UseGuards(JwtAuthGuard)
  async signOut(@Res() res: Response, @CurrentUser() user: any) {
    await this.signOutService.signOut(user.id);

    // Clear the cookie
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    });

    return res.json({
      statusCode: 200,
      message: 'Signed out successfully',
      data: [],
    });
  }
}
