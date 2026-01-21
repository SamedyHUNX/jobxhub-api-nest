import { Module } from '@nestjs/common';
import { InngestClientService } from './inngest.service';
import { ConfigModule } from '@nestjs/config';
import { InngestController } from './inngest.controller';

@Module({
  imports: [ConfigModule],
  providers: [InngestClientService],
  exports: [InngestClientService],
  controllers: [InngestController],
})
export class InngestModule {}
