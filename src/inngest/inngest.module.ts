import { Module } from '@nestjs/common';
import { InngestService } from './inngest.service';
import { InngestController } from './inngest.controller';

@Module({
  controllers: [InngestController],
  providers: [InngestService],
})
export class InngestModule {}
