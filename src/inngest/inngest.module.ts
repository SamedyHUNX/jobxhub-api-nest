import { Module } from '@nestjs/common';
import { InngestClientService } from './inngest.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [InngestClientService],
  exports: [InngestClientService],
})
export class InngestModule {}
