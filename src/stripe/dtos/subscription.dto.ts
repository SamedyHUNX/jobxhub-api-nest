import { IsString, IsEmail, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateSubscriptionDto {
    @IsEmail()
    email: string;

    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    priceId: string;

    @IsNumber()
    @Min(0)
    @IsOptional()
    trialPeriodDays?: number;
}

export class UpdateSubscriptionDto {
    @IsString()
    subscriptionId: string;

    @IsString()
    newPriceId: string;
}

export class CancelSubscriptionDto {
    @IsString()
    subscriptionId: string;

    @IsOptional()
    immediately?: boolean;
}