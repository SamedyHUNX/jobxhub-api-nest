import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { StripeClientService } from "./stripe-client.service";
import { ConfigService } from "@/common/services/config.service";
import { DrizzleHealthService } from "@/drizzle/services/drizzle-health.service";
import Stripe from 'stripe';
import { ExpandedInvoice, PlanName, SubscriptionStatus } from "../types/stripe.types";
import { eq } from "drizzle-orm";
import { PaymentHistoryTable, UserSubscriptionsTable } from "@/drizzle/schema";
import * as Sentry from '@sentry/node';

@Injectable()
export class StripeWebhookService {
    private readonly logger = new Logger(StripeWebhookService.name);

    constructor(
        private readonly stripeClientService: StripeClientService,
        private readonly configService: ConfigService,
        private readonly dbService: DrizzleHealthService,
    ) { }

    private getPlanNameFromPriceId(priceId: string): PlanName {
        return this.stripeClientService.getPlanNameFromPriceId(priceId);
    }


    async handleWebhook(signature: string, payload: Buffer): Promise<void> {
        const webhookSecret = this.configService.stripeWebhookSecret;
        let event: Stripe.Event;

        try {
            event = this.stripeClientService.client.webhooks.constructEvent(
                payload,
                signature,
                webhookSecret
            );
        } catch (error) {
            Sentry.captureException(error);
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
            Sentry.captureException(error);
            this.logger.error(`Error handling webhook ${event.type}`, error);
        }
    }

    private async handleSubscriptionUpdate(subscription: Stripe.Subscription) {
        const exists = await this.dbService.getDb().query.UserSubscriptionsTable.findFirst({
            where: eq(UserSubscriptionsTable.stripeSubscriptionId, subscription.id),
        });

        if (!exists) {
            // Subscription created via Checkout - create DB record
            const userId = subscription.metadata?.userId;
            if (!userId) {
                this.logger.error('No userId in subscription metadata');
                return;
            }

            const {
                items,
            } = subscription;

            const subscriptionItem = items.data[0];



            const priceId = subscription.items.data[0]?.price.id;

            await this.dbService.getDb().insert(UserSubscriptionsTable).values({
                userId,
                planName: this.getPlanNameFromPriceId(priceId),
                status: subscription.status as SubscriptionStatus,
                interval: this.stripeClientService.getIntervalFromPriceId(priceId),
                stripeCustomerId: typeof subscription.customer === 'string'
                    ? subscription.customer
                    : subscription.customer.id,
                stripeSubscriptionId: subscription.id,
                stripePriceId: priceId,
                currentPeriodStart: new Date(subscriptionItem.current_period_start * 1000),
                currentPeriodEnd: new Date(subscriptionItem.current_period_end * 1000),
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
                trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
                trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
            });
        } else {
            const {
                items,
            } = subscription;

            const subscriptionItem = items.data[0];
            // Update existing subscription
            await this.dbService.getDb()
                .update(UserSubscriptionsTable)
                .set({
                    status: subscription.status as SubscriptionStatus,
                    currentPeriodStart: new Date(subscriptionItem.current_period_start * 1000),
                    currentPeriodEnd: new Date(subscriptionItem.current_period_end * 1000),
                    cancelAtPeriodEnd: subscription.cancel_at_period_end,
                    updatedAt: new Date(),
                })
                .where(eq(UserSubscriptionsTable.stripeSubscriptionId, subscription.id));
        }
    }

    private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
        await this.dbService.getDb()
            .update(UserSubscriptionsTable)
            .set({
                status: SubscriptionStatus.CANCELED,
                canceledAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(UserSubscriptionsTable.stripeSubscriptionId, subscription.id));
    }

    private async handleInvoicePaid(invoice: ExpandedInvoice) {
        if (!invoice.subscription) return;

        const subscriptionId = typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription.id;

        const subscription = await this.dbService.getDb().query.UserSubscriptionsTable.findFirst({
            where: eq(UserSubscriptionsTable.stripeSubscriptionId, subscriptionId),
        });

        if (subscription) {
            const paymentIntentId = typeof invoice.payment_intent === 'string'
                ? invoice.payment_intent
                : invoice.payment_intent?.id ?? null;

            await this.dbService.getDb().insert(PaymentHistoryTable).values({
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

            if (subscription.status !== SubscriptionStatus.ACTIVE) {
                await this.dbService.getDb()
                    .update(UserSubscriptionsTable)
                    .set({
                        status: SubscriptionStatus.ACTIVE,
                        updatedAt: new Date(),
                    })
                    .where(eq(UserSubscriptionsTable.id, subscription.id));
            }
        }
    }

    private async handlePaymentFailed(invoice: ExpandedInvoice) {
        if (!invoice.subscription) return;

        const subscriptionId = typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription.id;

        const subscription = await this.dbService.getDb().query.UserSubscriptionsTable.findFirst({
            where: eq(UserSubscriptionsTable.stripeSubscriptionId, subscriptionId),
        });

        if (subscription) {
            await this.dbService.getDb().insert(PaymentHistoryTable).values({
                userId: subscription.userId,
                subscriptionId: subscription.id,
                stripeInvoiceId: invoice.id,
                amount: invoice.amount_due,
                currency: invoice.currency,
                status: 'failed',
            });

            await this.dbService.getDb()
                .update(UserSubscriptionsTable)
                .set({
                    status: SubscriptionStatus.PAST_DUE,
                    updatedAt: new Date(),
                })
                .where(eq(UserSubscriptionsTable.id, subscription.id));
        }
    }

    private async handlePaymentActionRequired(invoice: ExpandedInvoice) {
        if (!invoice.subscription) return;

        const subscriptionId = typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription.id;

        const subscription = await this.dbService.getDb().query.UserSubscriptionsTable.findFirst({
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
}