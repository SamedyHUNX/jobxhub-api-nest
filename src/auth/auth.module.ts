import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { S3Module } from '@/s3/s3.module';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt/jwt.strategy';
import { InngestModule } from '@/inngest/inngest.module';
import { ConfigService } from '@/config/config.service';
import { AppConfigModule } from '@/config/config.module';
import { CacheModule } from '@/cache/cache.module';

@Module({
  imports: [
    S3Module,
    PassportModule,
    InngestModule,
    AppConfigModule,
    CacheModule,
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
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
