import { ConfigService } from '@/common/services/config.service';
import { Injectable, Logger } from '@nestjs/common';
import { Inngest } from 'inngest';

@Injectable()
export class InngestClientService {
  private readonly logger = new Logger(InngestClientService.name);
  inngest: Inngest;

  constructor(private configService: ConfigService) {
    const eventKey = this.configService.inngestEventKey;
    const signingKey = this.configService.inngestSigningKey;
    this.logger.log(`Initializing Inngest client with id: jobxhub`);
    this.logger.debug(`Inngest event key configured: ${eventKey ? 'Yes' : 'No'}`);
    this.logger.debug(`Inngest signing key configured: ${signingKey ? 'Yes' : 'No'}`);

    this.inngest = new Inngest({
      id: 'jobxhub',
      eventKey: eventKey,
      signingKey: signingKey,
    });

    this.logger.log('Inngest client initialized successfully');
  }
}
