import { Module } from '@nestjs/common';
import { InngestController } from './inngest.controller';
import { InngestHealthService } from './services/inngest-health.service';
import { CommonModule } from '@/common/common.module';
import { InngestClientService } from './services/inngest-client.service';
import { AuthFunctions } from './services/functions/auth.functions';
import { AiFunctions } from './services/functions/ai.functions';
import { AgentsModule } from '@/agents/agents.module';
import { EmailFunctions } from './services/functions/email.functions';
@Module({
  imports: [CommonModule, AgentsModule],
  controllers: [InngestController],
  providers: [
    InngestHealthService,
    InngestClientService,
    AuthFunctions,
    AiFunctions,
    EmailFunctions,
  ],
  exports: [InngestHealthService, InngestClientService],
})
export class InngestModule { }
