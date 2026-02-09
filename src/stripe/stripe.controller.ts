import {
    Controller,
    Post,
    Put,
    Delete,
    Get,
    Body,
    Headers,
    Req,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser } from '@/decorators/current-user.decorator';
import { CancelSubscriptionDto, CreateSubscriptionDto, UpdateSubscriptionDto } from './dto/create-subscription.dto';
import type { RawBodyRequest } from '@/types';
import { JwtAuthGuard } from '@/auth/jwt/jwt.guard';
import { StripeSubscriptionService } from './services/stripe-subscription.service';
import { StripeCheckoutService } from './services/stripe-checkout.service';
import { StripePaymentHistoryService } from './services/stripe-payment-history.service';
import { StripeWebhookService } from './services/stripe-webhook.service';

@Controller('stripe')
export class StripeController {
    constructor(
        private stripeSubscriptionService: StripeSubscriptionService,
        private stripeCheckoutService: StripeCheckoutService,
        private stripePaymentHistory: StripePaymentHistoryService,
        private stripeWebhookService: StripeWebhookService
    ) { }

    // Option 1: Direct subscription creation (requires frontend payment collection)
    @Post('subscription')
    @UseGuards(JwtAuthGuard)
    async createSubscription(
        @CurrentUser('id') userId: string,
        @Body() dto: CreateSubscriptionDto,
    ) {
        return this.stripeSubscriptionService.createSubscription(userId, dto);
    }

    // Option 2: Checkout session (easier - Stripe hosts the payment page)
    @Post('checkout-session')
    @UseGuards(JwtAuthGuard)
    async createCheckoutSession(
        @CurrentUser('id') userId: string,
        @Body() body: CreateSubscriptionDto & { successUrl: string; cancelUrl: string },
    ) {
        const { successUrl, cancelUrl, ...dto } = body;
        const url = await this.stripeCheckoutService.createCheckoutSession(
            userId,
            dto,
            successUrl,
            cancelUrl,
        );
        return { url };
    }

    @Get('subscription')
    @UseGuards(JwtAuthGuard)
    async getSubscription(@CurrentUser('id') userId: string) {
        return this.stripeSubscriptionService.getUserSubscription(userId);
    }

    @Put('subscription')
    @UseGuards(JwtAuthGuard)
    async updateSubscription(
        @CurrentUser('id') userId: string,
        @Body() dto: UpdateSubscriptionDto,
    ) {
        return this.stripeSubscriptionService.updateSubscription(userId, dto);
    }

    @Delete('subscription')
    @UseGuards(JwtAuthGuard)
    async cancelSubscription(
        @CurrentUser('id') userId: string,
        @Body() dto: CancelSubscriptionDto,
    ) {
        return this.stripeSubscriptionService.cancelSubscription(userId, dto.cancelAtPeriodEnd ?? true);
    }

    @Post('subscription/reactivate')
    @UseGuards(JwtAuthGuard)
    async reactivateSubscription(@CurrentUser('id') userId: string) {
        return this.stripeSubscriptionService.reactivateSubscription(userId);
    }

    @Post('billing-portal')
    @UseGuards(JwtAuthGuard)
    async createBillingPortal(
        @CurrentUser('id') userId: string,
        @Body('returnUrl') returnUrl: string,
    ) {
        const url = await this.stripeCheckoutService.createBillingPortalSession(userId, returnUrl);
        return { url };
    }

    @Get('payment-history')
    @UseGuards(JwtAuthGuard)
    async getPaymentHistory(@CurrentUser('id') userId: string) {
        return this.stripePaymentHistory.getPaymentHistory(userId);
    }

    @Post('webhook')
    @HttpCode(HttpStatus.OK)
    async handleWebhook(
        @Headers('stripe-signature') signature: string,
        @Req() request: RawBodyRequest<Request>,
    ) {
        await this.stripeWebhookService.handleWebhook(signature, request.rawBody);
        return { received: true };
    }
}