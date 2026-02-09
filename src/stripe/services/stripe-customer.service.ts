import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { StripeClientService } from "./stripe-client.service";
import Stripe from 'stripe';
import { DrizzleHealthService } from "@/drizzle/services/drizzle-health.service";
import { UserSubscriptionsTable, UserTable } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import * as Sentry from "@sentry/nestjs";

@Injectable()
export class StripeCustomerService {
    private readonly logger = new Logger(StripeCustomerService.name);

    constructor(
        private readonly stripeClientService: StripeClientService,
        private readonly dbService: DrizzleHealthService,
    ) { }

    async createCustomer(userId: string, email: string, name?: string): Promise<Stripe.Customer> {
        try {
            const customer = await this.stripeClientService.client.customers.create({
                email,
                name,
                metadata: { userId },
            });

            this.logger.log(`Created Stripe customer ${customer.id} for user ${userId}`);
            return customer;
        } catch (error) {
            Sentry.captureException(error, { extra: { userId, email, name } });
            this.logger.error('Failed to create Stripe customer', error);
            throw new BadRequestException('Failed to create customer');
        }
    }

    async getOrCreateCustomer(userId: string): Promise<Stripe.Customer> {
        const existingSubscription = await this.dbService.getDb().query.UserSubscriptionsTable.findFirst({
            where: eq(UserSubscriptionsTable.userId, userId),
        });

        if (existingSubscription?.stripeCustomerId) {
            const customer = await this.stripeClientService.client.customers.retrieve(
                existingSubscription.stripeCustomerId
            );

            if (!customer.deleted) {
                return customer;
            }
        }

        const user = await this.dbService.getDb().query.UserTable.findFirst({
            where: eq(UserTable.id, userId),
        });

        if (!user) {
            Sentry.captureException(new Error('Someone is trying to create a customer for a non-existent user'), { extra: { userId } });
            this.logger.error('User not found', { userId });
            throw new NotFoundException('User not found');
        }

        return this.createCustomer(userId, user.email, user.username);
    }

    async updateCustomer(userId: string, name?: string): Promise<Stripe.Customer> {
        const existingSubscription = await this.dbService.getDb().query.UserSubscriptionsTable.findFirst({
            where: eq(UserSubscriptionsTable.userId, userId),
        });

        if (!existingSubscription?.stripeCustomerId) {
            Sentry.captureException(new Error('Someone is trying to update a customer for a non-existent user'), { extra: { userId } });
            this.logger.error('User not found', { userId });
            throw new NotFoundException('User not found');
        }

        const customer = await this.stripeClientService.client.customers.update(
            existingSubscription.stripeCustomerId,
            { name }
        );

        this.logger.log(`Updated Stripe customer ${customer.id} for user ${userId}`);
        return customer;
    }
}