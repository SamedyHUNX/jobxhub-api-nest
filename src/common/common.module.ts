import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HashingService } from './services/hashing.service';
import { ConfigService } from './services/config.service';
import { EmailService } from './services/email.service';
import { PermissionService } from './services/permission.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  providers: [HashingService, ConfigService, EmailService, PermissionService],
  exports: [HashingService, ConfigService, EmailService, PermissionService],
})
export class CommonModule { }
