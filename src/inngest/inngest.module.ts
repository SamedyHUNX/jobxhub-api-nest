import { Module } from '@nestjs/common';
import { InngestController } from './inngest.controller';
import { UserFunctionsService } from './services/user-functions.service';
import { InngestHealthService } from './services/inngest-health.service';
import { CommonModule } from '@/common/common.module';
import { InngestClientService } from './services/inngest.service';

@Module({
  imports: [CommonModule],
  controllers: [InngestController],
  providers: [
    UserFunctionsService,
    InngestHealthService,
    InngestClientService,
  ],
  exports: [InngestHealthService, UserFunctionsService],
})
export class InngestModule { }
