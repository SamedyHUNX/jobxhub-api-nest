import { Controller, Post, Body, Headers, Req, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { StripeService } from '../services/stripe.service';
import type { RawBodyRequest } from '@/types';


@Controller('stripe')
export class StripeController {
    constructor(private stripeService: StripeService) { }

    @Post('create-payment-intent')
    async createPaymentIntent(@Body() body: { amount: number; currency?: string }) {
        return this.stripeService.createPaymentIntent(body.amount, body.currency);
    }

    @Post('webhook')
    async handleWebhook(
        @Req() request: RawBodyRequest<Request>,
        @Headers('stripe-signature') signature: string,
    ) {
        if (!request.rawBody) {
            throw new BadRequestException('Missing raw body for Stripe webhook');
        }

        const event = await this.stripeService.constructWebhookEvent(
            request.rawBody,
            signature,
        );

        switch (event.type) {
            case 'payment_intent.succeeded':
                console.log('Payment succeeded:', event.data.object);
                break;
            case 'payment_intent.payment_failed':
                console.log('Payment failed:', event.data.object);
                break;
            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        return { received: true };
    }

}