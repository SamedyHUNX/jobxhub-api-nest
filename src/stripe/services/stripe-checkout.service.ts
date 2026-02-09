import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { StripeClientService } from "./stripe-client.service";
import { StripeCustomerService } from "./stripe-customer.service";
import { DrizzleHealthService } from "@/drizzle/services/drizzle-health.service";
import { CreateSubscriptionDto } from "../dto/create-subscription.dto";
import { StripeSubscriptionService } from "./stripe-subscription.service";

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
        userId: string,
        dto: CreateSubscriptionDto,
        successUrl: string,
        cancelUrl: string,
    ): Promise<string> {
        try {
            const customer = await this.stripeCustomerService.getOrCreateCustomer(userId);

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
                        metadata: { userId },
                    },
                }),
                metadata: { userId }, // Session metadata
            });

            return session.url!;
        } catch (error) {
            this.logger.error('Failed to create checkout session', error);
            throw new BadRequestException('Failed to create checkout session');
        }
    }

    async createBillingPortalSession(userId: string, returnUrl: string): Promise<string> {
        const subscription = await this.stripeSubscriptionService.getUserSubscription(userId);

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
            this.logger.error('Failed to create billing portal session', error);
            throw new BadRequestException('Failed to create billing portal session');
        }
    }
}