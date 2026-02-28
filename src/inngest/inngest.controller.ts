import { All, Controller, Logger, Req, Res } from '@nestjs/common';
import { serve } from 'inngest/express';
import { InngestHealthService } from './services/inngest-health.service';
import { AuthFunctions } from './services/functions/auth.functions';
import { AiFunctions } from './services/functions/ai.functions';
import { EmailFunctions } from './services/functions/email.functions';

@Controller('inngest')
export class InngestController {
  private readonly logger = new Logger(InngestController.name);
  private handler: ReturnType<typeof serve> | null = null;

  constructor(
    private readonly inngestService: InngestHealthService,
    private readonly authFunctions: AuthFunctions,
    private readonly aiFunctions: AiFunctions,
    private readonly emailFunctions: EmailFunctions,
  ) { }

  @All()
  handleInngest(@Req() req: Request, @Res() res: Response) {
    if (!this.handler) {
      this.handler = serve({
        client: this.inngestService.getInngest(),
        functions: [...this.authFunctions.getFunctions(), ...this.aiFunctions.getFunctions(), ...this.emailFunctions.getFunctions()],
      });
      this.logger.log('Inngest handler initialized');
    }

    return this.handler(req, res);
  }
}
