import { Module } from '@nestjs/common';
import { InngestController } from './inngest.controller';
import { AppConfigModule } from '@/config/config.module';
import { UserFunctionsService } from './functions/functions.service';
import { EmailService } from '@/email/email.service';
import { InngestClientService } from './services/inngest.service';
import { InngestHealthService } from './services/inngest-health.service';

@Module({
  imports: [AppConfigModule],
  exports: [InngestClientService, InngestHealthService],
  controllers: [InngestController],
  providers: [
    InngestClientService,
    UserFunctionsService,
    EmailService,
    InngestHealthService,
  ],
})
export class InngestModule {}
