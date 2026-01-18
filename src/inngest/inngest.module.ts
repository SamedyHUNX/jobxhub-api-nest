import { Module } from '@nestjs/common';
import { InngestController } from './inngest.controller';

@Module({
  controllers: [InngestController],
})
export class InngestModule {}
