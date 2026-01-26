import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { S3Module } from './s3/s3.module';
import { InngestModule } from './inngest/inngest.module';
import { RedisModule } from './redis/redis.module';
import { DrizzleModule } from './drizzle/drizzle.module';
import { ConfigService } from './config/config.service';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
import { APP_FILTER } from '@nestjs/core';
import { OrganizationsModule } from './organizations/organizations.module';

@Module({
  imports: [
    AppConfigModule,
    AuthModule,
    S3Module,
    InngestModule,
    RedisModule,
    DrizzleModule,
    OrganizationsModule,
    SentryModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    ConfigService,
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
  ],
})
export class AppModule {}
