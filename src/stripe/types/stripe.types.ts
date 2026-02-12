import Stripe from "stripe";
import { PlanName } from "./stripe.enums";

export interface StripeConfig {
    secretKey: string;
    webhookSecret: string;
    priceIds: {
        [key in PlanName]: {
            monthly: string;
            yearly: string;
        };
    };
}

export interface ExpandedInvoice extends Stripe.Invoice {
    subscription?: string | Stripe.Subscription;
    payment_intent?: string | Stripe.PaymentIntent | null;
}