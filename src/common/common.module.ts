import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HashingService } from './services/hashing.service';
import { ConfigService } from './services/config.service';
import { TokenService } from './services/token.service';
import { DatabaseUtilsService } from './services/database-utils.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  providers: [HashingService, ConfigService, TokenService, DatabaseUtilsService],
  exports: [HashingService, ConfigService, TokenService, DatabaseUtilsService],
})
export class CommonModule { }
