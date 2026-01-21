import { Module, Global } from '@nestjs/common';
import { DrizzleService } from './drizzle.service';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  providers: [DrizzleService],
  exports: [DrizzleService],
})
export class DrizzleModule {}
