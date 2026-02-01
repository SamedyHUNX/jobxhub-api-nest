import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { InngestClientService } from './inngest.service';

@Injectable()
export class InngestHealthService {
  private readonly logger = new Logger(InngestHealthService.name);

  constructor(private inngestService: InngestClientService) { }

  getInngest() {
    if (!this.inngestService || !this.inngestService.inngest) {
      const message = `Inngest client is down at ${new Date().toISOString()}`;
      this.logger.error(message);
      Sentry.captureException(new Error(message));
      throw new InternalServerErrorException('Inngest service unavailable');
    }
    return this.inngestService.inngest;
  }
}
