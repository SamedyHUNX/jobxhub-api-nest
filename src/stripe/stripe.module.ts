import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';
import { CommonModule } from '@/common/common.module';
import { DrizzleModule } from '@/drizzle/drizzle.module';
import { PermissionsModule } from '@/permissions/permissions.module';


@Module({
    imports: [CommonModule, DrizzleModule, PermissionsModule],
    controllers: [StripeController],
    providers: [StripeService],
    exports: [StripeService],
})
export class StripeModule { }