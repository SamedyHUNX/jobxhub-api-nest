import { Module } from '@nestjs/common';
import { StripeService } from './services/stripe.service';
import { StripeController } from './controllers/stripe.controller';
import { CommonModule } from '@/common/common.module';
import { SubscriptionService } from './services/subscription.service';

@Module({
    imports: [CommonModule],
    controllers: [StripeController],
    providers: [StripeService, SubscriptionService],
    exports: [StripeService, SubscriptionService],
})
export class StripeModule { }