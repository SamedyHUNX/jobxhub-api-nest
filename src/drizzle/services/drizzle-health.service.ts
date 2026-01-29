import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DrizzleService } from './drizzle.service';
import * as Sentry from '@sentry/node';

@Injectable()
export class DrizzleHealthService {
  private readonly logger = new Logger(DrizzleHealthService.name);

  constructor(private drizzleService: DrizzleService) {}

  getDb() {
    if (!this.drizzleService) {
      const message = `Database is down at ${new Date().toISOString()}`;
      this.logger.error(message);
      Sentry.captureException(new Error(message));
      throw new InternalServerErrorException('Database service unavailable');
    }
    return this.drizzleService.db;
  }
}
