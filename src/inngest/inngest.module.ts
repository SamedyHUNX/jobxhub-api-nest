import { Module } from '@nestjs/common';
import { InngestClientService } from './inngest.service';
import { InngestController } from './inngest.controller';
import { AppConfigModule } from '@/config/config.module';
import { UserFunctionsService } from './functions/functions.service';
import { EmailService } from '@/email/email.service';

@Module({
  imports: [AppConfigModule],
  exports: [InngestClientService],
  controllers: [InngestController],
  providers: [InngestClientService, UserFunctionsService, EmailService],
})
export class InngestModule {}
