import { EventSchemas, Inngest } from 'inngest';
import { Events } from './types/events.type';

const eventKey = process.env.INNGEST_EVENT_KEY;
if (!eventKey) {
  throw new Error('INNGEST_EVENT_KEY is required');
}

export const inngest = new Inngest({
  id: 'jobxhub',
  schemas: new EventSchemas().fromRecord<Events>(),
  eventKey: process.env.INNGEST_EVENT_KEY,
});
