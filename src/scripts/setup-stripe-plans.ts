import { AppModule } from "@/app.module";
import { NestFactory } from "@nestjs/core";
import { SubscriptionService } from "@/stripe/services/subscription.service";

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule)
    const stripeSubscriptionService = app.get(SubscriptionService)

    try {
        // Create basic plan
        const basicPlan = await stripeSubscriptionService.createSubscriptionPlan(
            'Basic Plan',
            'Basic Plan',
            10,
            100
        )
        console.log(basicPlan)
        // Create growth plan
        const growthPlan = await stripeSubscriptionService.createSubscriptionPlan(
            'Growth Plan',
            'Growth Plan',
            25,
            200
        )
        console.log(growthPlan)
        // Create enterprise plan
        const enterprisePlan = await stripeSubscriptionService.createSubscriptionPlan(
            'Enterprise Plan',
            'Enterprise Plan',
            100,
            1000,
        )
        console.log(enterprisePlan)

        console.log('Done')
        console.log(`Basic Plan: ${basicPlan.monthlyPriceId}`)
        console.log(`Growth Plan: ${growthPlan.monthlyPriceId}`)
        console.log(`Enterprise Plan: ${enterprisePlan.monthlyPriceId}`)
    } catch (error) {
        console.log(error)
    }

    await app.close()
}

bootstrap()