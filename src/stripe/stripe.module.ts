import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';
import { CommonModule } from '@/common/common.module';
import { DrizzleModule } from '@/drizzle/drizzle.module';
import { PermissionsModule } from '@/permissions/permissions.module';
import { ConfigModule } from '@nestjs/config';



@Module({
    imports: [CommonModule, DrizzleModule, PermissionsModule, ConfigModule.forRoot({ isGlobal: true, })],
    controllers: [StripeController],
    providers: [StripeService],
    exports: [StripeService],
})
export class StripeModule { }