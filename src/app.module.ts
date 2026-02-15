import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { S3Module } from './s3/s3.module';
import { InngestModule } from './inngest/inngest.module';
import { DrizzleModule } from './drizzle/drizzle.module';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
import { APP_FILTER } from '@nestjs/core';
import { OrganizationsModule } from './organizations/organizations.module';
import { UsersModule } from './users/user.module';
import { CacheModule } from './cache/cache.module';
import { CommonModule } from './common/common.module';
import { JobListingsModule } from './job-listings/job-listings.module';
import { StripeModule } from './stripe/stripe.module';
import { PermissionsModule } from './permissions/permissions.module';

@Module({
  imports: [
    AuthModule,
    S3Module,
    InngestModule,
    CommonModule,
    CacheModule,
    DrizzleModule,
    OrganizationsModule,
    UsersModule,
    JobListingsModule,
    StripeModule,
    PermissionsModule,
    SentryModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
  ],
})
export class AppModule { }
