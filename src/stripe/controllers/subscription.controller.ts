// subscription.controller.ts
import {
    Controller,
    Post,
    Get,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    Headers,
    Req,
} from '@nestjs/common';
import { Request } from 'express';
import { CancelSubscriptionDto, CreateSubscriptionDto, UpdateSubscriptionDto } from '@/stripe/dtos/subscription.dto';
import { StripeService } from '@/stripe/services/stripe.service';
import type { RawBodyRequest } from '@/types';

@Controller('subscriptions')
export class SubscriptionController {
    constructor(private stripeService: StripeService) { }

    @Post('create')
    async createSubscription(@Body() dto: CreateSubscriptionDto) {
        // First, create a customer
        const customer = await this.stripeService.createCustomer(
            dto.email,
            dto.name,
        );

        // Then create the subscription
        const subscription = await this.stripeService.createSubscription(
            customer.id,
            dto.priceId,
            dto.trialPeriodDays,
        );

        return {
            customerId: customer.id,
            subscriptionId: subscription.id,
            clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
        };
    }

    @Post('checkout')
    async createCheckout(
        @Body() body: {
            customerId?: string;
            email: string;
            priceId: string;
            successUrl: string;
            cancelUrl: string;
            trialPeriodDays?: number;
        },
    ) {
        let customerId = body.customerId;

        // Create customer if not provided
        if (!customerId) {
            const customer = await this.stripeService.createCustomer(body.email);
            customerId = customer.id;
        }

        const session = await this.stripeService.createSubscriptionCheckout(
            customerId,
            body.priceId,
            body.successUrl,
            body.cancelUrl,
            body.trialPeriodDays,
        );

        return { url: session.url };
    }

    @Get(':subscriptionId')
    async getSubscription(@Param('subscriptionId') subscriptionId: string) {
        return await this.stripeService.getSubscription(subscriptionId);
    }

    @Get('customer/:customerId')
    async getCustomerSubscriptions(@Param('customerId') customerId: string) {
        return await this.stripeService.listCustomerSubscriptions(customerId);
    }

    @Patch('update')
    async updateSubscription(@Body() dto: UpdateSubscriptionDto) {
        return await this.stripeService.updateSubscription(
            dto.subscriptionId,
            dto.newPriceId,
        );
    }

    @Delete('cancel')
    async cancelSubscription(@Body() dto: CancelSubscriptionDto) {
        return await this.stripeService.cancelSubscription(
            dto.subscriptionId,
            dto.immediately,
        );
    }

    @Post('resume/:subscriptionId')
    async resumeSubscription(@Param('subscriptionId') subscriptionId: string) {
        return await this.stripeService.resumeSubscription(subscriptionId);
    }

    @Post('billing-portal')
    async createBillingPortal(
        @Body() body: { customerId: string; returnUrl: string },
    ) {
        const session = await this.stripeService.createBillingPortalSession(
            body.customerId,
            body.returnUrl,
        );
        return { url: session.url };
    }

    @Post('webhook')
    async handleWebhook(
        @Req() request: RawBodyRequest<Request>,
        @Headers('stripe-signature') signature: string,
    ) {
        const event = await this.stripeService.constructWebhookEvent(
            request.rawBody,
            signature,
        );

        // Handle different subscription events
        switch (event.type) {
            case 'customer.subscription.created':
                console.log('Subscription created:', event.data.object);
                // Update your database: user now has active subscription
                break;

            case 'customer.subscription.updated':
                console.log('Subscription updated:', event.data.object);
                // Handle subscription changes (upgrade/downgrade)
                break;

            case 'customer.subscription.deleted':
                console.log('Subscription cancelled:', event.data.object);
                // Update your database: subscription ended
                break;

            case 'invoice.paid':
                console.log('Invoice paid:', event.data.object);
                // Subscription payment successful
                break;

            case 'invoice.payment_failed':
                console.log('Payment failed:', event.data.object);
                // Handle failed payment (send email, restrict access, etc.)
                break;

            case 'customer.subscription.trial_will_end':
                console.log('Trial ending soon:', event.data.object);
                // Send reminder email about trial ending
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        return { received: true };
    }
}