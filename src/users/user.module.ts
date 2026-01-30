import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { S3Module } from '@/s3/s3.module';
import { PassportModule } from '@nestjs/passport';
import { InngestModule } from '@/inngest/inngest.module';
import { AppConfigModule } from '@/config/config.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@/config/config.service';

@Module({
  imports: [
    S3Module,
    PassportModule,
    InngestModule,
    AppConfigModule,
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
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
