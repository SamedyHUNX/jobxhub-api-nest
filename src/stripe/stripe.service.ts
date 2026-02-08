// src/modules/stripe/stripe.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import Stripe from 'stripe';
import { UserSubscriptionsTable, PaymentHistoryTable, UserTable } from '../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { PlanName, SubscriptionStatus } from './types/stripe.types';
import { DrizzleHealthService } from '@/drizzle/services/drizzle-health.service';
import { ConfigService } from '@/common/services/config.service';
import { CreateSubscriptionDto, UpdateSubscriptionDto } from './dto/create-subscription.dto';

@Injectable()
export class StripeService {
    private readonly stripe: Stripe;
    private readonly logger = new Logger(StripeService.name);
    private readonly priceIds: Record<string, { monthly: string; yearly: string }>;

    constructor(
        private readonly configService: ConfigService,
        private readonly dbHealth: DrizzleHealthService,
    ) {
        this.stripe = new Stripe(this.configService.stripeSecret, {
            apiVersion: '2026-01-28.clover'
        });


        this.priceIds = {
            [PlanName.BASIC]: {
                monthly: this.configService.stripeBasicMonthlyPriceId,
                yearly: this.configService.stripeBasicYearlyPriceId,
            },
            [PlanName.GROWTH]: {
                monthly: this.configService.stripeGrowthMonthlyPriceId,
                yearly: this.configService.stripeGrowthYearlyPriceId,
            },
            [PlanName.ENTERPRISE]: {
                monthly: this.configService.stripeEnterpriseMonthlyPriceId,
                yearly: this.configService.stripeEnterpriseYearlyPriceId,
            },
        };
    }

    get db() {
        return this.dbHealth.getDb()
    }

    async createCustomer(userId: string, email: string, name?: string): Promise<Stripe.Customer> {
        try {
            const customer = await this.stripe.customers.create({
                email,
                name,
                metadata: { userId },
            });

            this.logger.log(`Created Stripe customer ${customer.id} for user ${userId}`);
            return customer;
        } catch (error) {
            this.logger.error('Failed to create Stripe customer', error);
            throw new BadRequestException('Failed to create customer');
        }
    }

    async createSubscription(
        userId: string,
        dto: CreateSubscriptionDto,
    ): Promise<{ subscriptionId: string; clientSecret: string }> {
        try {
            // Get or create Stripe customer
            let customer = await this.getOrCreateCustomer(userId);

            // Get price ID
            const priceId = this.priceIds[dto.planName][dto.interval];

            // Create subscription
            const subscription = await this.stripe.subscriptions.create({
                customer: customer.id,
                items: [{ price: priceId }],
                payment_behavior: 'default_incomplete',
                payment_settings: { save_default_payment_method: 'on_subscription' },
                expand: ['latest_invoice.payment_intent'],
                trial_period_days: dto.trialPeriod ? 14 : undefined,
                metadata: { userId },
            });

            // Save to database
            await this.db.insert(UserSubscriptionsTable).values({
                userId,
                planName: dto.planName,
                status: subscription.status as SubscriptionStatus,
                interval: dto.interval,
                stripeCustomerId: customer.id,
                stripeSubscriptionId: subscription.id,
                stripePriceId: priceId,
                currentPeriodStart: new Date(subscription.current_period_start * 1000),
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
                trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
            });

            const invoice = subscription.latest_invoice as Stripe.Invoice;
            const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

            return {
                subscriptionId: subscription.id,
                clientSecret: paymentIntent.client_secret,
            };
        } catch (error) {
            this.logger.error('Failed to create subscription', error);
            throw new BadRequestException('Failed to create subscription');
        }
    }

    async updateSubscription(userId: string, dto: UpdateSubscriptionDto) {
        const subscription = await this.getUserSubscription(userId);

        if (!subscription) {
            throw new NotFoundException('No active subscription found');
        }

        try {
            const priceId = this.priceIds[dto.planName][dto.interval];

            const updated = await this.stripe.subscriptions.update(
                subscription.stripeSubscriptionId,
                {
                    items: [{
                        id: (await this.stripe.subscriptions.retrieve(subscription.stripeSubscriptionId)).items.data[0].id,
                        price: priceId,
                    }],
                    proration_behavior: 'always_invoice',
                }
            );

            await this.db.db
                .update(UserSubscriptionsTable)
                .set({
                    planName: dto.planName,
                    interval: dto.interval,
                    stripePriceId: priceId,
                    updatedAt: new Date(),
                })
                .where(eq(UserSubscriptionsTable.id, subscription.id));

            return updated;
        } catch (error) {
            this.logger.error('Failed to update subscription', error);
            throw new BadRequestException('Failed to update subscription');
        }
    }

    async cancelSubscription(userId: string, cancelAtPeriodEnd: boolean = true) {
        const subscription = await this.getUserSubscription(userId);

        if (!subscription) {
            throw new NotFoundException('No active subscription found');
        }

        try {
            const updated = await this.stripe.subscriptions.update(
                subscription.stripeSubscriptionId,
                { cancel_at_period_end: cancelAtPeriodEnd }
            );

            await this.db.db
                .update(UserSubscriptionsTable)
                .set({
                    cancelAtPeriodEnd,
                    canceledAt: cancelAtPeriodEnd ? null : new Date(),
                    status: cancelAtPeriodEnd ? subscription.status : SubscriptionStatus.CANCELED,
                    updatedAt: new Date(),
                })
                .where(eq(UserSubscriptionsTable.id, subscription.id));

            return updated;
        } catch (error) {
            this.logger.error('Failed to cancel subscription', error);
            throw new BadRequestException('Failed to cancel subscription');
        }
    }

    async handleWebhook(signature: string, payload: Buffer): Promise<void> {
        const webhookSecret = this.configService.stripeWebhookSecret;

        let event: Stripe.Event;

        try {
            event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
        } catch (error) {
            this.logger.error('Webhook signature verification failed', error);
            throw new BadRequestException('Invalid signature');
        }

        this.logger.log(`Processing webhook event: ${event.type}`);

        switch (event.type) {
            case 'customer.subscription.updated':
            case 'customer.subscription.created':
                await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
                break;
            case 'customer.subscription.deleted':
                await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
                break;
            case 'invoice.paid':
                await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
                break;
            case 'invoice.payment_failed':
                await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
                break;
            default:
                this.logger.log(`Unhandled event type: ${event.type}`);
        }
    }

    private async handleSubscriptionUpdate(subscription: Stripe.Subscription) {
        await this.db.db
            .update(UserSubscriptionsTable)
            .set({
                status: subscription.status as SubscriptionStatus,
                currentPeriodStart: new Date(subscription.current_period_start * 1000),
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
                updatedAt: new Date(),
            })
            .where(eq(UserSubscriptionsTable.stripeSubscriptionId, subscription.id));
    }

    private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
        await this.db.db
            .update(UserSubscriptionsTable)
            .set({
                status: SubscriptionStatus.CANCELED,
                canceledAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(UserSubscriptionsTable.stripeSubscriptionId, subscription.id));
    }

    private async handleInvoicePaid(invoice: Stripe.Invoice) {
        const subscription = await this.db.db.query.UserSubscriptionsTable.findFirst({
            where: eq(UserSubscriptionsTable.stripeSubscriptionId, invoice.subscription as string),
        });

        if (subscription) {
            await this.db.db.insert(PaymentHistoryTable).values({
                userId: subscription.userId,
                subscriptionId: subscription.id,
                stripeInvoiceId: invoice.id,
                stripePaymentIntentId: invoice.payment_intent as string,
                amount: invoice.amount_paid,
                currency: invoice.currency,
                status: 'paid',
                paidAt: new Date(invoice.status_transitions.paid_at * 1000),
            });
        }
    }

    private async handlePaymentFailed(invoice: Stripe.Invoice) {
        const subscription = await this.db.db.query.UserSubscriptionsTable.findFirst({
            where: eq(UserSubscriptionsTable.stripeSubscriptionId, invoice.subscription as string),
        });

        if (subscription) {
            await this.db.insert(PaymentHistoryTable).values({
                userId: subscription.userId,
                subscriptionId: subscription.id,
                stripeInvoiceId: invoice.id,
                amount: invoice.amount_due,
                currency: invoice.currency,
                status: 'failed',
            });

            await this.db.
                update(UserSubscriptionsTable)
                .set({
                    status: SubscriptionStatus.PAST_DUE,
                    updatedAt: new Date(),
                })
                .where(eq(UserSubscriptionsTable.id, subscription.id));
        }
    }

    private async getUserSubscription(userId: string) {
        return this.db.query.UserSubscriptionsTable.findFirst({
            where: and(
                eq(UserSubscriptionsTable.userId, userId),
                eq(UserSubscriptionsTable.status, SubscriptionStatus.ACTIVE)
            ),
        });
    }

    private async getOrCreateCustomer(userId: string): Promise<Stripe.Customer> {
        // Check if customer exists in DB
        const subscription = await this.db.query.UserSubscriptionsTable.findFirst({
            where: eq(UserSubscriptionsTable.userId, userId),
        });

        if (subscription?.stripeCustomerId) {
            return this.stripe.customers.retrieve(subscription.stripeCustomerId) as Promise<Stripe.Customer>;
        }

        // Get user email from your user table
        const user = await this.db.query.UserTable.findFirst({
            where: eq(UserTable.id, userId),
        });

        return this.createCustomer(userId, user.email, user.firstName + ' ' + user.lastName);
    }
}