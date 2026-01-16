import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { S3Module } from '@/s3/s3.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt/jwt.strategy';

@Module({
  imports: [
    S3Module,
    PassportModule,
    JwtModule.registerAsync({
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: Number(configService.get<string>('JWT_EXPIRES_IN')),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, JwtStrategy],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
