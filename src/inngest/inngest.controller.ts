import { All, Controller, Module, Req, Res } from '@nestjs/common';
import { serve } from 'inngest/express';
import { InngestClientService } from './inngest.service';
import { UserFunctionsService } from './functions/functions.service';

@Controller('inngest')
export class InngestController {
  constructor(
    private inngestClientService: InngestClientService,
    private userFunctionsService: UserFunctionsService,
  ) {}

  @All()
  handleInngest(@Req() req, @Res() res) {
    const handler = serve({
      client: this.inngestClientService.inngest,
      functions: this.userFunctionsService.getFunctions(),
    });

    return handler(req, res);
  }
}
