import { Module } from '@nestjs/common';
import { InngestController } from './inngest.controller';
import { UserFunctionsService } from './functions/functions.service';
import { InngestClientService } from './services/inngest.service';
import { InngestHealthService } from './services/inngest-health.service';
import { CommonModule } from '@/common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [InngestController],
  providers: [
    InngestClientService,
    UserFunctionsService,
    InngestHealthService,
  ],
  exports: [InngestClientService, InngestHealthService],
})
export class InngestModule { }
