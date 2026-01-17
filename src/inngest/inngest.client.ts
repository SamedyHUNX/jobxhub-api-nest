import { EventSchemas, Inngest } from 'inngest';
import { Events } from './types/events.type';

export const inngest = new Inngest({
  id: 'jobxhub',
  schemas: new EventSchemas().fromRecord<Events>(),
  eventKey: process.env.INNGEST_EVENT_KEY,
});
