import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HashingService } from './services/hashing.service';
import { ConfigService } from './services/config.service';
import { EmailService } from './services/email.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  providers: [HashingService, ConfigService, EmailService],
  exports: [HashingService, ConfigService, EmailService],
})
export class CommonModule { }
