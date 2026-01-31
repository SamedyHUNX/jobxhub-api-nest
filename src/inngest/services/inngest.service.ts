import { ConfigService } from '@/common/services/config.service';
import { Injectable, Logger } from '@nestjs/common';
import { EventSchemas, Inngest } from 'inngest';
import { Events } from '../types/events.type';

@Injectable()
export class InngestClientService {
  private readonly logger = new Logger(InngestClientService.name);
  inngest: Inngest;

  constructor(private configService: ConfigService) {
    const eventKey = this.configService.inngestEventKey;
    this.logger.log(`Initializing Inngest client with id: jobxhub`);
    this.logger.debug(`Inngest event key configured: ${eventKey ? 'Yes' : 'No'}`);
    
    this.inngest = new Inngest({
      id: 'jobxhub',
      schemas: new EventSchemas().fromRecord<Events>(),
      eventKey: eventKey,
    });
    
    this.logger.log('Inngest client initialized successfully');
  }
}
