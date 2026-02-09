import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HashingService } from './services/hashing.service';
import { ConfigService } from './services/config.service';
import { EmailService } from './services/email.service';
import { TokenService } from './services/token.service';
import { UtilsService } from './services/utils.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  providers: [HashingService, ConfigService, EmailService, TokenService, UtilsService],
  exports: [HashingService, ConfigService, EmailService, TokenService, UtilsService],
})
export class CommonModule { }
