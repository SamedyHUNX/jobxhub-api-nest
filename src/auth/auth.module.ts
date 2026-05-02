import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { S3Module } from '@/s3/s3.module';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt/jwt.strategy';
import { InngestModule } from '@/inngest/inngest.module';
import { ConfigService } from '@/common/services/config.service';
import { CacheModule } from '@/cache/cache.module';
import { CommonModule } from '@/common/common.module';
import { SignUpService } from './services/sign-up.service';
import { SignInService } from './services/sign-in.service';
import { VerifyEmailService } from './services/verify-email.service';
import { ForgotPasswordService } from './services/forgot-password.service';
import { ResetPasswordService } from './services/reset-password.service';
import { SignOutService } from './services/sign-out.service';
import { ValidateUserService } from './services/validate-user.service';
import { PermissionsModule } from '@/permissions/permissions.module';

@Module({
  imports: [
    S3Module,
    PassportModule,
    InngestModule,
    CacheModule,
    CommonModule,
    PermissionsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.jwtSecret;
        if (!secret) throw new Error('JWT_SECRET is required');
        const expiresIn = configService.jwtExpiresIn;
        return {
          secret,
          signOptions: { expiresIn },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    SignUpService,
    SignInService,
    VerifyEmailService,
    ForgotPasswordService,
    ResetPasswordService,
    SignOutService,
    ValidateUserService
  ],
})
export class AuthModule { }
