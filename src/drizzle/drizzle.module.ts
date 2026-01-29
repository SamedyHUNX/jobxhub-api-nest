import { Module, Global } from '@nestjs/common';
import { DrizzleService } from './services/drizzle.service';
import { DrizzleHealthService } from './services/drizzle-health.service';

@Global()
@Module({
  providers: [DrizzleService, DrizzleHealthService],
  exports: [DrizzleService, DrizzleHealthService],
})
export class DrizzleModule {}
