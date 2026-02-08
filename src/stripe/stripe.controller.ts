import {
    Controller,
    Post,
    Put,
    Delete,
    Body,
    Headers,
    Req,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { StripeService } from './stripe.service';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '@/decorators/current-user.decorator';
import { CancelSubscriptionDto, CreateSubscriptionDto, UpdateSubscriptionDto } from './dto/create-subscription.dto';
import type { RawBodyRequest } from "@/types"

@Controller('stripe')
export class StripeController {
    constructor(private readonly stripeService: StripeService) { }

    @Post('subscription')
    @UseGuards(AuthGuard)
    async createSubscription(
        @CurrentUser('id') userId: string,
        @Body() dto: CreateSubscriptionDto,
    ) {
        return this.stripeService.createSubscription(userId, dto);
    }

    @Put('subscription')
    @UseGuards(AuthGuard)
    async updateSubscription(
        @CurrentUser('id') userId: string,
        @Body() dto: UpdateSubscriptionDto,
    ) {
        return this.stripeService.updateSubscription(userId, dto);
    }

    @Delete('subscription')
    @UseGuards(AuthGuard)
    async cancelSubscription(
        @CurrentUser('id') userId: string,
        @Body() dto: CancelSubscriptionDto,
    ) {
        return this.stripeService.cancelSubscription(userId, dto.cancelAtPeriodEnd);
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