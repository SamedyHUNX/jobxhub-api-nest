import { ConfigService } from "@/common/services/config.service";
import { Injectable } from "@nestjs/common";
import Stripe from "stripe";

@Injectable()
export class SubscriptionService {
    private stripe: Stripe

    constructor(private configService: ConfigService) {
        this.stripe = new Stripe(this.configService.stripeSecret, {
            apiVersion: '2026-01-28.clover',
        });
    }

    async createProduct(name: string, description: string) {
        return await this.stripe.products.create({
            name,
            description,
        });
    }

    async createPrice(
        productId: string,
        unitAmount: number,
        currency: string = 'usd',
        interval: 'month' | 'year' = 'month'
    ) {
        return await this.stripe.prices.create({
            product: productId,
            unit_amount: unitAmount,
            currency,
            recurring: {
                interval,
            },
        });
    }

    // Create a complete subscription plan
    async createSubscriptionPlan(
        name: string,
        description: string,
        monthlyPrice: number,
        yearlyPrice?: number
    ) {
        // Create the product
        const product = await this.createProduct(name, description);

        // Create the monthly price
        const monthlyPriceObj = await this.createPrice(product.id, monthlyPrice, 'usd', 'month');

        const result: any = {
            productId: product.id,
            monthlyPriceId: monthlyPriceObj.id,
        };

        // Create the yearly price if provided
        if (yearlyPrice) {
            const yearlyPriceObj = await this.createPrice(product.id, yearlyPrice, 'usd', 'year');
            result.yearlyPriceId = yearlyPriceObj.id;
        }

        return result;
    }
}