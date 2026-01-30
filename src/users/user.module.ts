import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { S3Module } from '@/s3/s3.module';
import { PassportModule } from '@nestjs/passport';
import { InngestModule } from '@/inngest/inngest.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@/common/services/config.service';
import { CommonModule } from '@/common/common.module';

@Module({
  imports: [
    S3Module,
    PassportModule,
    InngestModule,
    CommonModule,
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
export class UsersModule { }
