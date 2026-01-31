import { All, Controller, Logger, Req, Res } from '@nestjs/common';
import { serve } from 'inngest/express';
import { UserFunctionsService } from './functions/functions.service';
import { InngestClientService } from './services/inngest.service';

@Controller('inngest')
export class InngestController {
  private readonly logger = new Logger(InngestController.name);

  constructor(
    private inngestClientService: InngestClientService,
    private userFunctionsService: UserFunctionsService,
  ) {
    // Log that functions are registered
    const functions = this.userFunctionsService.getFunctions();
    this.logger.log(`Inngest controller initialized with ${functions.length} functions`);
    functions.forEach((fn, index) => {
      this.logger.log(`Function ${index + 1}: ${fn.id || 'unknown'}`);
    });
  }

  @All()
  handleInngest(@Req() req, @Res() res) {
    this.logger.debug(`Inngest endpoint called: ${req.method} ${req.url}`);
    
    const handler = serve({
      client: this.inngestClientService.inngest,
      functions: this.userFunctionsService.getFunctions(),
    });

    return handler(req, res);
  }
}
