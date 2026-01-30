import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { S3Service } from './s3.service';
import * as Sentry from '@sentry/node';

@Injectable()
export class S3HealthService {
  private readonly logger = new Logger(S3HealthService.name);

  constructor(private s3Service: S3Service) {}

  getS3() {
    if (!this.s3Service) {
      const message = `S3 service is down at ${new Date().toISOString()}`;
      this.logger.error(message);
      Sentry.captureException(new Error(message));
      throw new InternalServerErrorException('S3 service unavailable');
    }
    return this.s3Service;
  }
}
