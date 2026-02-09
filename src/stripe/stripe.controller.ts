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
import type { RawBodyRequest, User } from '@/types';
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
        @CurrentUser() user: User,
        @Body() dto: CreateSubscriptionDto,
    ) {
        console.log('=== Controller Debug ===');
        console.log('User:', user);
        console.log('DTO:', dto);
        console.log('DTO keys:', Object.keys(dto));
        console.log('planName:', dto.planName);
        console.log('interval:', dto.interval);
        console.log('=======================');

        return this.stripeSubscriptionService.createSubscription(user.id, dto);
    }



    // Option 2: Checkout session (easier - Stripe hosts the payment page)
    @Post('checkout-session')
    @UseGuards(JwtAuthGuard)
    async createCheckoutSession(
        @CurrentUser() user: User,
        @Body() body: CreateSubscriptionDto & { successUrl: string; cancelUrl: string },
    ) {
        const { successUrl, cancelUrl, ...dto } = body;
        const url = await this.stripeCheckoutService.createCheckoutSession(
            user.id,
            dto,
            successUrl,
            cancelUrl,
        );
        return { url };
    }

    @Get('subscription')
    @UseGuards(JwtAuthGuard)
    async getSubscription(@CurrentUser() user: User) {
        return this.stripeSubscriptionService.getUserSubscription(user.id);
    }

    @Put('subscription')
    @UseGuards(JwtAuthGuard)
    async updateSubscription(
        @CurrentUser() user: User,
        @Body() dto: UpdateSubscriptionDto,
    ) {
        return this.stripeSubscriptionService.updateSubscription(user.id, dto);
    }

    @Delete('subscription')
    @UseGuards(JwtAuthGuard)
    async cancelSubscription(
        @CurrentUser() user: User,
        @Body() dto: CancelSubscriptionDto,
    ) {
        return this.stripeSubscriptionService.cancelSubscription(user.id, dto.cancelAtPeriodEnd ?? true);
    }

    @Post('subscription/reactivate')
    @UseGuards(JwtAuthGuard)
    async reactivateSubscription(@CurrentUser() user: User) {
        return this.stripeSubscriptionService.reactivateSubscription(user.id);
    }

    @Post('billing-portal')
    @UseGuards(JwtAuthGuard)
    async createBillingPortal(
        @CurrentUser() user: User,
        @Body('returnUrl') returnUrl: string,
    ) {
        const url = await this.stripeCheckoutService.createBillingPortalSession(user.id, returnUrl);
        return { url };
    }

    @Get('payment-history')
    @UseGuards(JwtAuthGuard)
    async getPaymentHistory(@CurrentUser() user: User) {
        return this.stripePaymentHistory.getPaymentHistory(user.id);
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