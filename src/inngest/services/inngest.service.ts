import { ConfigService } from '@/common/services/config.service';
import { Injectable } from '@nestjs/common';
import { EventSchemas, Inngest } from 'inngest';
import { Events } from '../types/events.type';

@Injectable()
export class InngestClientService {
  inngest: Inngest;

  constructor(private configService: ConfigService) {
    this.inngest = new Inngest({
      id: 'jobxhub',
      schemas: new EventSchemas().fromRecord<Events>(),
      eventKey: this.configService.inngestEventKey,
    });
  }
}
