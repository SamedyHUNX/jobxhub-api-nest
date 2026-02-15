import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { PlanName, BillingInterval } from '../types/stripe.enums';

export class CreateSubscriptionDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsEnum(PlanName)
    @IsNotEmpty()
    planName: PlanName;

    @IsEnum(BillingInterval)
    @IsNotEmpty()
    interval: BillingInterval;

    @IsOptional()
    @IsBoolean()
    trialPeriod?: boolean;
}

export class UpdateSubscriptionDto {
    @IsOptional()
    @IsEnum(PlanName)
    planName?: PlanName;

    @IsOptional()
    @IsEnum(BillingInterval)
    interval?: BillingInterval;
}

export class CancelSubscriptionDto {
    @IsOptional()
    @IsBoolean()
    cancelAtPeriodEnd?: boolean;
}