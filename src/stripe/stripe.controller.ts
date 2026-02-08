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
import { StripeService } from './stripe.service';
import { CurrentUser } from '@/decorators/current-user.decorator';
import { CancelSubscriptionDto, CreateSubscriptionDto, UpdateSubscriptionDto } from './dto/create-subscription.dto';
import type { RawBodyRequest } from '@/types';
import { JwtAuthGuard } from '@/auth/jwt/jwt.guard';

@Controller('stripe')
export class StripeController {
    constructor(private readonly stripeService: StripeService) { }

    // Option 1: Direct subscription creation (requires frontend payment collection)
    @Post('subscription')
    @UseGuards(JwtAuthGuard)
    async createSubscription(
        @CurrentUser('id') userId: string,
        @Body() dto: CreateSubscriptionDto,
    ) {
        return this.stripeService.createSubscription(userId, dto);
    }

    // Option 2: Checkout session (easier - Stripe hosts the payment page)
    @Post('checkout-session')
    @UseGuards(JwtAuthGuard)
    async createCheckoutSession(
        @CurrentUser('id') userId: string,
        @Body() body: CreateSubscriptionDto & { successUrl: string; cancelUrl: string },
    ) {
        const { successUrl, cancelUrl, ...dto } = body;
        const url = await this.stripeService.createCheckoutSession(
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
        return this.stripeService.getUserSubscription(userId);
    }

    @Put('subscription')
    @UseGuards(JwtAuthGuard)
    async updateSubscription(
        @CurrentUser('id') userId: string,
        @Body() dto: UpdateSubscriptionDto,
    ) {
        return this.stripeService.updateSubscription(userId, dto);
    }

    @Delete('subscription')
    @UseGuards(JwtAuthGuard)
    async cancelSubscription(
        @CurrentUser('id') userId: string,
        @Body() dto: CancelSubscriptionDto,
    ) {
        return this.stripeService.cancelSubscription(userId, dto.cancelAtPeriodEnd ?? true);
    }

    @Post('subscription/reactivate')
    @UseGuards(JwtAuthGuard)
    async reactivateSubscription(@CurrentUser('id') userId: string) {
        return this.stripeService.reactivateSubscription(userId);
    }

    @Post('billing-portal')
    @UseGuards(JwtAuthGuard)
    async createBillingPortal(
        @CurrentUser('id') userId: string,
        @Body('returnUrl') returnUrl: string,
    ) {
        const url = await this.stripeService.createBillingPortalSession(userId, returnUrl);
        return { url };
    }

    @Get('payment-history')
    @UseGuards(JwtAuthGuard)
    async getPaymentHistory(@CurrentUser('id') userId: string) {
        return this.stripeService.getPaymentHistory(userId);
    }

    @Post('webhook')
    @HttpCode(HttpStatus.OK)
    async handleWebhook(
        @Headers('stripe-signature') signature: string,
        @Req() request: RawBodyRequest<Request>,
    ) {
        await this.stripeService.handleWebhook(signature, request.rawBody);
        return { received: true };
    }
}