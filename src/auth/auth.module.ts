import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { S3Service } from '@/s3/s3.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, S3Service],
})
export class AuthModule {}
