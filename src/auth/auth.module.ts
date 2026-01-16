import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { S3Module } from '@/s3/s3.module';

@Module({
  imports: [S3Module, PassportModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
