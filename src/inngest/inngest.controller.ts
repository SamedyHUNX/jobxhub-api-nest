import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { serve } from 'inngest/express';
import { InngestClientService } from './inngest-client.service';
// import { createUser, forgotPassword } from './functions/auth';

@Controller('api/inngest')
export class InngestController {
  private inngestHandler: ReturnType<typeof serve>;

  constructor(private readonly inngestClientService: InngestClientService) {
    this.inngestHandler = serve({
      client: this.inngestClientService.inngest,
      functions: [
        // createUser,
        // forgotPassword,
        // more functions
      ],
    });
  }

  @All()
  async handleInngest(@Req() req: Request, @Res() res: Response) {
    await this.inngestHandler(req, res);
  }
}
