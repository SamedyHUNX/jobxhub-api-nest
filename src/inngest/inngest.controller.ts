import { All, Controller, Logger, Req, Res } from '@nestjs/common';
import { serve } from 'inngest/express';
import { UserFunctionsService } from './services/user-functions.service';
import { InngestHealthService } from './services/inngest-health.service';

@Controller('inngest')
export class InngestController {
  private readonly logger = new Logger(InngestController.name);
  private handler: ReturnType<typeof serve> | null = null;

  constructor(
    private readonly inngestService: InngestHealthService,
    private readonly userFunctionsService: UserFunctionsService,
  ) { }

  @All()
  handleInngest(@Req() req: Request, @Res() res: Response) {
    if (!this.handler) {
      this.handler = serve({
        client: this.inngestService.getInngest(),
        functions: this.userFunctionsService.getFunctions(),
      });
      this.logger.log('Inngest handler initialized');
    }

    return this.handler(req, res);
  }
}
