import { CacheHealthService } from '@/cache/services/cache-health.service';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { InngestClientService } from './inngest.service';

@Injectable()
export class InngestHealthService {
  private readonly logger = new Logger(CacheHealthService.name);

  constructor(private inngestService: InngestClientService) {}

  getInngest() {
    if (!this.inngestService || !this.inngestService.inngest) {
      const message = `Inngest client is down at ${new Date().toISOString()}`;
      this.logger.error(message);
      Sentry.captureException(new Error(message));
      throw new InternalServerErrorException('Event service unavailable');
    }
    return this.inngestService.inngest;
  }
}
