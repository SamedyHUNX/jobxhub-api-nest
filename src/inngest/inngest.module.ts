import { Module } from '@nestjs/common';
import { InngestController } from './inngest.controller';
import { UserFunctionsService } from './functions/functions.service';
import { EmailService } from '@/common/services/email.service';
import { InngestClientService } from './services/inngest.service';
import { InngestHealthService } from './services/inngest-health.service';
import { CommonModule } from '@/common/common.module';

@Module({
  imports: [CommonModule],
  exports: [InngestClientService, InngestHealthService],
  controllers: [InngestController],
  providers: [
    InngestClientService,
    UserFunctionsService,
    EmailService,
    InngestHealthService,
  ],
})
export class InngestModule { }
