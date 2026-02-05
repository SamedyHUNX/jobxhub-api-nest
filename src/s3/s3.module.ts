import { Module } from '@nestjs/common';
import { S3Service } from './services/s3.service';
import { S3Controller } from './s3.controller';
import { S3HealthService } from './services/s3-health.service';
import { CommonModule } from '@/common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [S3Controller],
  providers: [S3Service, S3HealthService],
  exports: [S3Service, S3HealthService],
})
export class S3Module { }
