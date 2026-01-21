import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { S3Module } from '@/s3/s3.module';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt/jwt.strategy';
import { InngestModule } from '@/inngest/inngest.module';
import { ConfigService } from '@/config/config.service';
@Module({
  imports: [
    S3Module,
    PassportModule,
    InngestModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) throw new Error('JWT_SECRET is required');
        const expiresInRaw = configService.get<string>('JWT_EXPIRES_IN');
        const expiresInParsed = Number(expiresInRaw);
        const expiresIn = Number.isFinite(expiresInParsed)
          ? expiresInParsed
          : 3600;
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
