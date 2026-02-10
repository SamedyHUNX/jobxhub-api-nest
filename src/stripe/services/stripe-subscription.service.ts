import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { StripeClientService } from "./stripe-client.service";
import { StripeCustomerService } from "./stripe-customer.service";
import { DrizzleHealthService } from "@/drizzle/services/drizzle-health.service";
import { CreateSubscriptionDto, UpdateSubscriptionDto } from "../dto/create-subscription.dto";
import { UserSubscriptionsTable } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { SubscriptionStatus } from "../types/stripe.types";
import Stripe from 'stripe';
import { UserCacheService } from "@/cache/services/user-cache.service";
import * as Sentry from "@sentry/nestjs";
import type { User } from "@/types";

@Injectable()
export class StripeSubscriptionService {
    private readonly logger = new Logger(StripeSubscriptionService.name);

    constructor(
        private readonly userCacheService: UserCacheService,
        private readonly stripeClientService: StripeClientService,
        private readonly stripeCustomerService: StripeCustomerService,
        private readonly dbService: DrizzleHealthService,
    ) { }

    async createSubscription(userId: string, dto: CreateSubscriptionDto) {
        try {
            // Get or create Stripe customer
            const customer = await this.stripeCustomerService.getOrCreateCustomer(userId);

            // Get price ID
            const priceId = this.stripeClientService.getPriceId[dto.planName][dto.interval];

            // Create subscription
            const subscription = await this.stripeClientService.client.subscriptions.create({
                customer: customer.id,
                items: [{ price: priceId }],
                payment_behavior: 'default_incomplete',
                payment_settings: { save_default_payment_method: 'on_subscription' },
                expand: ['latest_invoice.payment_intent'],
                ...(dto.trialPeriod && { trial_period_days: 14 }),
                metadata: { userId },
            });

            const {
                id: subscriptionId,
                status,
                items,
                trial_start,
                trial_end,
                latest_invoice,
            } = subscription;

            const subscriptionItem = items.data[0];

            // Save to database
            await this.dbService.getDb().insert(UserSubscriptionsTable).values({
                userId,
                planName: dto.planName,
                status: status as SubscriptionStatus,
                interval: dto.interval,
                stripeCustomerId: customer.id,
                stripeSubscriptionId: subscriptionId,
                stripePriceId: priceId,
                currentPeriodStart: new Date(subscriptionItem.current_period_start * 1000),
                currentPeriodEnd: new Date(subscriptionItem.current_period_end * 1000),
                trialStart: trial_start ? new Date(trial_start * 1000) : null,
                trialEnd: trial_end ? new Date(trial_end * 1000) : null,
            });

            // Invalidate cache so next request gets fresh subscription data
            await Promise.all([
                this.userCacheService.clearUserById(userId),
                this.userCacheService.invalidateAllSessions(userId),
            ]);

            // Extract client secret from expanded invoice
            const clientSecret =
                typeof latest_invoice === 'object' &&
                    typeof (latest_invoice as any).payment_intent === 'object'
                    ? (latest_invoice as any).payment_intent.client_secret ?? null
                    : null;

            return { subscriptionId, clientSecret };
        } catch (error) {
            Sentry.captureException(error);
            this.logger.error('Failed to create subscription', error);
            throw new BadRequestException('Failed to create subscription');
        }
    }

    async updateSubscription(user: User, dto: UpdateSubscriptionDto) {
        const subscription = await this.getUserSubscription(user);

        if (!subscription) {
            throw new NotFoundException('No active subscription found');
        }

        try {
            const priceId = this.stripeClientService.getPriceId[dto.planName!][dto.interval!];

            // Retrieve current subscription to get item ID
            const currentSub = await this.stripeClientService.client.subscriptions.retrieve(
                subscription.stripeSubscriptionId
            );

            const updated = await this.stripeClientService.client.subscriptions.update(
                subscription.stripeSubscriptionId,
                {
                    items: [{
                        id: currentSub.items.data[0].id,
                        price: priceId,
                    }],
                    proration_behavior: 'always_invoice',
                }
            );

            const { items } = updated;
            const subscriptionItem = items.data[0];

            await this.dbService.getDb()
                .update(UserSubscriptionsTable)
                .set({
                    planName: dto.planName,
                    interval: dto.interval,
                    stripePriceId: priceId,
                    currentPeriodStart: new Date(subscriptionItem.current_period_start * 1000),
                    currentPeriodEnd: new Date(subscriptionItem.current_period_end * 1000),
                    updatedAt: new Date(),
                })
                .where(eq(UserSubscriptionsTable.id, subscription.id));

            // Invalidate cache so next request gets fresh subscription data
            await Promise.all([
                this.userCacheService.clearUserById(user.id),
                this.userCacheService.clearUserByEmail(user.email),
                this.userCacheService.invalidateAllSessions(user.id),
            ]);

            return updated;
        } catch (error) {
            Sentry.captureException(error);
            this.logger.error('Failed to update subscription', error);
            throw new BadRequestException('Failed to update subscription');
        }
    }

    async cancelSubscription(user: User, cancelAtPeriodEnd: boolean = true) {
        const subscription = await this.getUserSubscription(user);

        if (!subscription) {
            throw new NotFoundException('No active subscription found');
        }

        try {
            let updated: Stripe.Subscription;

            if (cancelAtPeriodEnd) {
                // Schedule cancellation at period end
                updated = await this.stripeClientService.client.subscriptions.update(
                    subscription.stripeSubscriptionId,
                    { cancel_at_period_end: true }
                );
            } else {
                // Cancel immediately
                updated = await this.stripeClientService.client.subscriptions.cancel(
                    subscription.stripeSubscriptionId
                );
            }

            await this.dbService.getDb()
                .update(UserSubscriptionsTable)
                .set({
                    cancelAtPeriodEnd,
                    canceledAt: cancelAtPeriodEnd ? null : new Date(),
                    status: updated.status as SubscriptionStatus,
                    updatedAt: new Date(),
                })
                .where(eq(UserSubscriptionsTable.id, subscription.id));

            // Invalidate cache so next request gets fresh subscription data
            await Promise.all([
                this.userCacheService.clearUserById(user.id),
                this.userCacheService.clearUserByEmail(user.email),
                this.userCacheService.invalidateAllSessions(user.id),
            ]);

            return updated;
        } catch (error) {
            Sentry.captureException(error);
            this.logger.error('Failed to cancel subscription', error);
            throw new BadRequestException('Failed to cancel subscription');
        }
    }

    async reactivateSubscription(user: User) {
        const subscription = await this.getUserSubscription(user);

        if (!subscription || !subscription.cancelAtPeriodEnd) {
            throw new BadRequestException('No subscription to reactivate');
        }

        try {
            const updated = await this.stripeClientService.client.subscriptions.update(
                subscription.stripeSubscriptionId,
                { cancel_at_period_end: false }
            );

            await this.dbService.getDb()
                .update(UserSubscriptionsTable)
                .set({
                    cancelAtPeriodEnd: false,
                    canceledAt: null,
                    status: updated.status as SubscriptionStatus,
                    updatedAt: new Date(),
                })
                .where(eq(UserSubscriptionsTable.id, subscription.id));

            // Invalidate cache so next request gets fresh subscription data
            await Promise.all([
                this.userCacheService.clearUserById(user.id),
                this.userCacheService.clearUserByEmail(user.email),
                this.userCacheService.invalidateAllSessions(user.id),
            ]);

            return updated;
        } catch (error) {
            Sentry.captureException(error);
            this.logger.error('Failed to reactivate subscription', error);
            throw new BadRequestException('Failed to reactivate subscription');
        }
    }

    async getUserSubscription(user: User) {
        try {
            return await this.dbService.getDb().query.UserSubscriptionsTable.findFirst({
                where: eq(UserSubscriptionsTable.userId, user.id),
                orderBy: (table, { desc }) => [desc(table.createdAt)],
            });
        } catch (error) {
            Sentry.captureException(error);
            this.logger.error('Failed to get user subscription', error);
            throw new BadRequestException('Failed to get user subscription');
        }
    }
}