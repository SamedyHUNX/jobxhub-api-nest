import { Module } from '@nestjs/common';
import { StripeController } from './stripe.controller';
import { CommonModule } from '@/common/common.module';
import { DrizzleModule } from '@/drizzle/drizzle.module';
import { PermissionsModule } from '@/permissions/permissions.module';
import { StripeClientService } from './services/stripe-client.service';
import { StripeCheckoutService } from './services/stripe-checkout.service';
import { StripeCustomerService } from './services/stripe-customer.service';
import { StripePaymentHistoryService } from './services/stripe-payment-history.service';
import { StripeSubscriptionService } from './services/stripe-subscription.service';
import { StripeWebhookService } from './services/stripe-webhook.service';
import { CacheModule } from '@/cache/cache.module';


@Module({
    imports: [CommonModule, DrizzleModule, PermissionsModule, CacheModule],
    controllers: [StripeController],
    providers: [StripeClientService, StripeCheckoutService, StripeCustomerService, StripePaymentHistoryService, StripeSubscriptionService, StripeWebhookService],
})
export class StripeModule { }