import { All, Controller, Logger, OnModuleInit, Req, Res } from '@nestjs/common';
import { serve } from 'inngest/express';
import { UserFunctionsService } from './services/user-functions.service';
import { InngestHealthService } from './services/inngest-health.service';

@Controller('inngest')
export class InngestController implements OnModuleInit {
  private readonly logger = new Logger(InngestController.name);

  constructor(
    private readonly inngestHealthService: InngestHealthService,
    private readonly userFunctionsService: UserFunctionsService,
  ) {}

  onModuleInit() {
    const functions = this.userFunctionsService.getFunctions();
    this.logger.log(`Inngest controller initialized with ${functions.length} functions`);
    functions.forEach((fn, index) => {
      this.logger.log(`Function ${index + 1}: ${fn?.id ?? 'unknown'}`);
    });
  }

  @All()
  handleInngest(@Req() req, @Res() res) {
    this.logger.debug(`Inngest endpoint called: ${req.method} ${req.url}`);

    const functions = this.userFunctionsService.getFunctions();
    this.logger.debug(`Serving ${functions.length} functions to Inngest`);

    const handler = serve({
      client: this.inngestHealthService.getInngest(),
      functions,
    });

    return handler(req, res);
  }
}
