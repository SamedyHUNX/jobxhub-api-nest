import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { StripeClientService } from "./stripe-client.service";
import { StripeCustomerService } from "./stripe-customer.service";
import { DrizzleHealthService } from "@/drizzle/services/drizzle-health.service";
import { CreateSubscriptionDto } from "../dto/create-subscription.dto";
import { StripeSubscriptionService } from "./stripe-subscription.service";
import * as Sentry from "@sentry/nestjs";
import type { User } from "@/types";

@Injectable()
export class StripeCheckoutService {
    private readonly logger = new Logger(StripeCheckoutService.name);

    constructor(
        private readonly stripeClientService: StripeClientService,
        private readonly stripeCustomerService: StripeCustomerService,
        private readonly stripeSubscriptionService: StripeSubscriptionService,
        private readonly dbService: DrizzleHealthService,
    ) { }

    async createCheckoutSession(
        user: User,
        dto: CreateSubscriptionDto,
        successUrl: string,
        cancelUrl: string,
    ): Promise<string> {
        try {
            const customer = await this.stripeCustomerService.getOrCreateCustomer(user.id);

            const priceId = this.stripeClientService.getPriceId(dto.planName, dto.interval);

            const session = await this.stripeClientService.client.checkout.sessions.create({
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
                        metadata: { userId: user.id },
                    },
                }),
                metadata: { userId: user.id }, // Session metadata
            });

            return session.url!;
        } catch (error) {
            Sentry.captureException(error);
            this.logger.error('Failed to create checkout session', error);
            throw new BadRequestException('Failed to create checkout session');
        }
    }

    async createBillingPortalSession(user: User, returnUrl: string): Promise<string> {
        const subscription = await this.stripeSubscriptionService.getUserSubscription(user);

        if (!subscription) {
            throw new NotFoundException('No subscription found');
        }

        try {
            const session = await this.stripeClientService.client.billingPortal.sessions.create({
                customer: subscription.stripeCustomerId,
                return_url: returnUrl,
            });

            return session.url;
        } catch (error) {
            Sentry.captureException(error);
            this.logger.error('Failed to create billing portal session', error);
            throw new BadRequestException('Failed to create billing portal session');
        }
    }
}