import { AppService } from '@/app.service';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AppService.name);
}
