
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import Stripe from 'stripe';
import { UserSubscriptionsTable, PaymentHistoryTable, UserTable } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { PlanName, BillingInterval, SubscriptionStatus } from './types/stripe.types';
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
        this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY')!, {
            apiVersion: "2026-01-28.clover"
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

    private get db() {
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
    ): Promise<{ subscriptionId: string; clientSecret: string | null }> {
        try {
            // Get or create Stripe customer
            const customer = await this.getOrCreateCustomer(userId);

            // Get price ID
            const priceId = this.priceIds[dto.planName][dto.interval];

            // Create subscription
            const subscription = await this.stripe.subscriptions.create({
                customer: customer.id,
                items: [{ price: priceId }],
                payment_behavior: 'default_incomplete',
                payment_settings: { save_default_payment_method: 'on_subscription' },
                expand: ['latest_invoice.payment_intent'],
                ...(dto.trialPeriod && { trial_period_days: 14 }),
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

            // Extract client secret safely
            let clientSecret: string | null = null;

            if (subscription.latest_invoice && typeof subscription.latest_invoice === 'object') {
                const invoice = subscription.latest_invoice;
                if (invoice.payment_intent && typeof invoice.payment_intent === 'object') {
                    clientSecret = invoice.payment_intent.client_secret;
                }
            }

            return {
                subscriptionId: subscription.id,
                clientSecret,
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
            const priceId = this.priceIds[dto.planName!][dto.interval!];

            // Retrieve current subscription to get item ID
            const currentSub = await this.stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);

            const updated = await this.stripe.subscriptions.update(
                subscription.stripeSubscriptionId,
                {
                    items: [{
                        id: currentSub.items.data[0].id,
                        price: priceId,
                    }],
                    proration_behavior: 'always_invoice',
                }
            );

            await this.db
                .update(UserSubscriptionsTable)
                .set({
                    planName: dto.planName,
                    interval: dto.interval,
                    stripePriceId: priceId,
                    currentPeriodStart: new Date(updated.current_period_start * 1000),
                    currentPeriodEnd: new Date(updated.current_period_end * 1000),
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
            let updated: Stripe.Subscription;

            if (cancelAtPeriodEnd) {
                // Schedule cancellation at period end
                updated = await this.stripe.subscriptions.update(
                    subscription.stripeSubscriptionId,
                    { cancel_at_period_end: true }
                );
            } else {
                // Cancel immediately
                updated = await this.stripe.subscriptions.cancel(
                    subscription.stripeSubscriptionId
                );
            }

            await this.db
                .update(UserSubscriptionsTable)
                .set({
                    cancelAtPeriodEnd,
                    canceledAt: cancelAtPeriodEnd ? null : new Date(),
                    status: updated.status as SubscriptionStatus,
                    updatedAt: new Date(),
                })
                .where(eq(UserSubscriptionsTable.id, subscription.id));

            return updated;
        } catch (error) {
            this.logger.error('Failed to cancel subscription', error);
            throw new BadRequestException('Failed to cancel subscription');
        }
    }

    async reactivateSubscription(userId: string) {
        const subscription = await this.getUserSubscription(userId);

        if (!subscription || !subscription.cancelAtPeriodEnd) {
            throw new BadRequestException('No subscription to reactivate');
        }

        try {
            const updated = await this.stripe.subscriptions.update(
                subscription.stripeSubscriptionId,
                { cancel_at_period_end: false }
            );

            await this.db
                .update(UserSubscriptionsTable)
                .set({
                    cancelAtPeriodEnd: false,
                    canceledAt: null,
                    status: updated.status as SubscriptionStatus,
                    updatedAt: new Date(),
                })
                .where(eq(UserSubscriptionsTable.id, subscription.id));

            return updated;
        } catch (error) {
            this.logger.error('Failed to reactivate subscription', error);
            throw new BadRequestException('Failed to reactivate subscription');
        }
    }

    async createBillingPortalSession(userId: string, returnUrl: string): Promise<string> {
        const subscription = await this.getUserSubscription(userId);

        if (!subscription) {
            throw new NotFoundException('No subscription found');
        }

        try {
            const session = await this.stripe.billingPortal.sessions.create({
                customer: subscription.stripeCustomerId,
                return_url: returnUrl,
            });

            return session.url;
        } catch (error) {
            this.logger.error('Failed to create billing portal session', error);
            throw new BadRequestException('Failed to create billing portal session');
        }
    }

    async createCheckoutSession(
        userId: string,
        dto: CreateSubscriptionDto,
        successUrl: string,
        cancelUrl: string,
    ): Promise<string> {
        try {
            const customer = await this.getOrCreateCustomer(userId);
            const priceId = this.priceIds[dto.planName][dto.interval];

            const session = await this.stripe.checkout.sessions.create({
                customer: customer.id,
                mode: 'subscription',
                payment_method_types: ['card'],
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                success_url: successUrl,
                cancel_url: cancelUrl,
                ...(dto.trialPeriod && {
                    subscription_data: {
                        trial_period_days: 14,
                    },
                }),
                metadata: { userId },
            });

            return session.url!;
        } catch (error) {
            this.logger.error('Failed to create checkout session', error);
            throw new BadRequestException('Failed to create checkout session');
        }
    }

    async handleWebhook(signature: string, payload: Buffer): Promise<void> {
        const webhookSecret = this.configService.get('STRIPE_WEBHOOK_SECRET')!;

        let event: Stripe.Event;

        try {
            event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
        } catch (error) {
            this.logger.error('Webhook signature verification failed', error);
            throw new BadRequestException('Invalid signature');
        }

        this.logger.log(`Processing webhook event: ${event.type}`);

        try {
            switch (event.type) {
                case 'customer.subscription.updated':
                case 'customer.subscription.created':
                    await this.handleSubscriptionUpdate(event.data.object);
                    break;
                case 'customer.subscription.deleted':
                    await this.handleSubscriptionDeleted(event.data.object);
                    break;
                case 'invoice.paid':
                    await this.handleInvoicePaid(event.data.object);
                    break;
                case 'invoice.payment_failed':
                    await this.handlePaymentFailed(event.data.object);
                    break;
                case 'invoice.payment_action_required':
                    await this.handlePaymentActionRequired(event.data.object);
                    break;
                case 'checkout.session.completed':
                    await this.handleCheckoutCompleted(event.data.object);
                    break;
                default:
                    this.logger.log(`Unhandled event type: ${event.type}`);
            }
        } catch (error) {
            this.logger.error(`Error handling webhook ${event.type}`, error);
            // Don't throw - we still want to return 200 to Stripe
        }
    }

    private async handleSubscriptionUpdate(subscription: Stripe.Subscription) {
        const exists = await this.db.query.UserSubscriptionsTable.findFirst({
            where: eq(UserSubscriptionsTable.stripeSubscriptionId, subscription.id),
        });

        if (!exists) {
            // Subscription created via Checkout - create DB record
            const userId = subscription.metadata?.userId;
            if (!userId) {
                this.logger.error('No userId in subscription metadata');
                return;
            }

            const priceId = subscription.items.data[0]?.price.id;

            await this.db.insert(UserSubscriptionsTable).values({
                userId,
                planName: this.getPlanNameFromPriceId(priceId),
                status: subscription.status as SubscriptionStatus,
                interval: this.getIntervalFromPriceId(priceId),
                stripeCustomerId: typeof subscription.customer === 'string'
                    ? subscription.customer
                    : subscription.customer.id,
                stripeSubscriptionId: subscription.id,
                stripePriceId: priceId,
                currentPeriodStart: new Date(subscription.current_period_start * 1000),
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
                trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
                trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
            });
        } else {
            // Update existing subscription
            await this.db
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
    }

    private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
        await this.db
            .update(UserSubscriptionsTable)
            .set({
                status: SubscriptionStatus.CANCELED,
                canceledAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(UserSubscriptionsTable.stripeSubscriptionId, subscription.id));
    }

    private async handleInvoicePaid(invoice: Stripe.Invoice) {
        if (!invoice.subscription) return;

        const subscriptionId = typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription.id;

        const subscription = await this.db.db.query.UserSubscriptionsTable.findFirst({
            where: eq(UserSubscriptionsTable.stripeSubscriptionId, subscriptionId),
        });

        if (subscription) {
            const paymentIntentId = typeof invoice.payment_intent === 'string'
                ? invoice.payment_intent
                : invoice.payment_intent?.id ?? null;

            await this.db.insert(PaymentHistoryTable).values({
                userId: subscription.userId,
                subscriptionId: subscription.id,
                stripeInvoiceId: invoice.id,
                stripePaymentIntentId: paymentIntentId,
                amount: invoice.amount_paid,
                currency: invoice.currency,
                status: 'paid',
                paidAt: invoice.status_transitions?.paid_at
                    ? new Date(invoice.status_transitions.paid_at * 1000)
                    : new Date(),
            });

            // Update subscription status to active if it was in trial/incomplete
            if (subscription.status !== SubscriptionStatus.ACTIVE) {
                await this.db
                    .update(UserSubscriptionsTable)
                    .set({
                        status: SubscriptionStatus.ACTIVE,
                        updatedAt: new Date(),
                    })
                    .where(eq(UserSubscriptionsTable.id, subscription.id));
            }
        }
    }

    private async handlePaymentFailed(invoice: Stripe.Invoice) {
        if (!invoice.subscription) return;

        const subscriptionId = typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription.id;

        const subscription = await this.db.query.UserSubscriptionsTable.findFirst({
            where: eq(UserSubscriptionsTable.stripeSubscriptionId, subscriptionId),
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

            await this.db
                .update(UserSubscriptionsTable)
                .set({
                    status: SubscriptionStatus.PAST_DUE,
                    updatedAt: new Date(),
                })
                .where(eq(UserSubscriptionsTable.id, subscription.id));
        }
    }

    private async handlePaymentActionRequired(invoice: Stripe.Invoice) {
        if (!invoice.subscription) return;

        const subscriptionId = typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription.id;

        const subscription = await this.db.query.UserSubscriptionsTable.findFirst({
            where: eq(UserSubscriptionsTable.stripeSubscriptionId, subscriptionId),
        });

        if (subscription) {
            this.logger.warn(`Payment action required for subscription ${subscription.id}`);
            // TODO: Send email to user with payment link
        }
    }

    private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
        this.logger.log(`Checkout completed: ${session.id}`);
        // The subscription.created webhook will handle the DB update
    }

    async getUserSubscription(userId: string) {
        return this.db.query.UserSubscriptionsTable.findFirst({
            where: eq(UserSubscriptionsTable.userId, userId),
            orderBy: (table, { desc }) => [desc(table.createdAt)],
        });
    }

    async getPaymentHistory(userId: string) {
        return this.db.query.PaymentHistoryTable.findMany({
            where: eq(PaymentHistoryTable.userId, userId),
            orderBy: (table, { desc }) => [desc(table.createdAt)],
        });
    }

    private async getOrCreateCustomer(userId: string): Promise<Stripe.Customer> {
        // Check if customer exists in DB
        const existingSubscription = await this.db.query.UserSubscriptionsTable.findFirst({
            where: eq(UserSubscriptionsTable.userId, userId),
        });

        if (existingSubscription?.stripeCustomerId) {
            const customer = await this.stripe.customers.retrieve(existingSubscription.stripeCustomerId);

            if (!customer.deleted) {
                return customer;
            }
        }

        // Get user from DB
        const user = await this.db.query.UserTable.findFirst({
            where: eq(UserTable.id, userId),
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return this.createCustomer(userId, user.email, user.username);
    }

    private getPlanNameFromPriceId(priceId: string): PlanName {
        for (const [planName, prices] of Object.entries(this.priceIds)) {
            if (prices.monthly === priceId || prices.yearly === priceId) {
                return planName as PlanName;
            }
        }
        return PlanName.BASIC; // Default fallback
    }

    private getIntervalFromPriceId(priceId: string): BillingInterval {
        for (const prices of Object.values(this.priceIds)) {
            if (prices.monthly === priceId) return BillingInterval.MONTH;
            if (prices.yearly === priceId) return BillingInterval.YEAR;
        }
        return BillingInterval.MONTH; // Default fallback
    }
}