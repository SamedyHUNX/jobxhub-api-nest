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

    // Create a customer
    async createCustomer(email: string, name?: string) {
        return await this.stripe.customers.create({
            email,
            name,
        });
    }

    // Create a subscription
    async createSubscription(
        customerId: string,
        priceId: string,
        trialPeriodDays?: number,
    ) {
        const subscriptionData: Stripe.SubscriptionCreateParams = {
            customer: customerId,
            items: [{ price: priceId }],
            payment_behavior: 'default_incomplete',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            expand: ['latest_invoice.payment_intent'],
        };

        if (trialPeriodDays) {
            subscriptionData.trial_period_days = trialPeriodDays;
        }

        return await this.stripe.subscriptions.create(subscriptionData);
    }

    // Create checkout session for subscription
    async createSubscriptionCheckout(
        customerId: string,
        priceId: string,
        successUrl: string,
        cancelUrl: string,
        trialPeriodDays?: number,
    ) {
        const sessionData: Stripe.Checkout.SessionCreateParams = {
            customer: customerId,
            mode: 'subscription',
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: successUrl,
            cancel_url: cancelUrl,
        };

        if (trialPeriodDays) {
            sessionData.subscription_data = {
                trial_period_days: trialPeriodDays,
            };
        }

        return await this.stripe.checkout.sessions.create(sessionData);
    }

    // Get subscription details
    async getSubscription(subscriptionId: string) {
        return await this.stripe.subscriptions.retrieve(subscriptionId);
    }

    // Update subscription (upgrade/downgrade)
    async updateSubscription(subscriptionId: string, newPriceId: string) {
        const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);

        return await this.stripe.subscriptions.update(subscriptionId, {
            items: [
                {
                    id: subscription.items.data[0].id,
                    price: newPriceId,
                },
            ],
            proration_behavior: 'create_prorations', // Handle prorated charges
        });
    }

    // Cancel subscription
    async cancelSubscription(subscriptionId: string, immediately: boolean = false) {
        if (immediately) {
            return await this.stripe.subscriptions.cancel(subscriptionId);
        } else {
            // Cancel at period end
            return await this.stripe.subscriptions.update(subscriptionId, {
                cancel_at_period_end: true,
            });
        }
    }

    // Resume a subscription that's set to cancel
    async resumeSubscription(subscriptionId: string) {
        return await this.stripe.subscriptions.update(subscriptionId, {
            cancel_at_period_end: false,
        });
    }

    // List all customer subscriptions
    async listCustomerSubscriptions(customerId: string) {
        return await this.stripe.subscriptions.list({
            customer: customerId,
            status: 'all',
            expand: ['data.default_payment_method'],
        });
    }

    // Create a billing portal session
    async createBillingPortalSession(customerId: string, returnUrl: string) {
        return await this.stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,
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