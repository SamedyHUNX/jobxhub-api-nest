import { ConfigService } from '@/common/services/config.service';
import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
    private stripe: Stripe;

    constructor(private configService: ConfigService) {
        this.stripe = new Stripe(this.configService.stripeSecret, {
            apiVersion: '2026-01-28.clover',
        });

    }

    async createPaymentIntent(amount: number, currency: string = 'usd') {
        return await this.stripe.paymentIntents.create({
            amount,
            currency,
        });
    }

    async createCustomer(email: string, name?: string) {
        return await this.stripe.customers.create({
            email,
            name,
        });
    }

    async createCheckoutSession(priceId: string, successUrl: string, cancelUrl: string) {
        return await this.stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: successUrl,
            cancel_url: cancelUrl,
        });
    }

    async constructWebhookEvent(payload: Buffer, signature: string) {
        const webhookSecret = this.configService.stripeWebhookSecret;
        return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    }
}