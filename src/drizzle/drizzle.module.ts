import { Module, Global } from '@nestjs/common';
import { DrizzleService } from './services/drizzle.service';
import { DrizzleHealthService } from './services/drizzle-health.service';
import { CommonModule } from '@/common/common.module';

@Global()
@Module({
  imports: [CommonModule],
  providers: [DrizzleService, DrizzleHealthService],
  exports: [DrizzleService, DrizzleHealthService],
})
export class DrizzleModule { }

