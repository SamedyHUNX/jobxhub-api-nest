import { UserCacheService } from "@/cache/services/user-cache.service";
import { BadRequestException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import type { PayloadType } from "../jwt/types/jwt.types";
import { DatabaseUtilsService } from "@/common/services/database-utils.service";
import { SubscriptionPermissionsService } from "@/permissions/services/subscription-permissions.service";

@Injectable()
export class ValidateUserService {
    private logger = new Logger(ValidateUserService.name)
    constructor(private userCacheService: UserCacheService, private dbUtilsService: DatabaseUtilsService, private subscriptionService: SubscriptionPermissionsService) { }

    async validateUser(payload: PayloadType) {
        if (!payload?.email || !payload?.sub || payload.tokenVersion == null) {
            throw new BadRequestException('Invalid payload: missing required fields');
        }

        const cachedUser = await this.userCacheService.getUserByEmail(payload.email);

        if (cachedUser) {
            if (payload.tokenVersion !== cachedUser.tokenVersion) {
                await this.userCacheService.clearUserById(cachedUser.id);
                this.logger.error(`Token version mismatch for user ID ${cachedUser.id}, email ${payload.email}`);
                throw new UnauthorizedException('Token invalidated. Please sign in again.');
            }
            return cachedUser;
        }

        const user = await this.dbUtilsService.findUserByUserIdOrEmail(payload.sub, undefined);
        if (!user) {
            this.logger.error(`User with ID ${payload.sub}, email ${payload.email} not found`);
            throw new UnauthorizedException('User not found');
        }

        if (payload.tokenVersion !== user.tokenVersion) {
            this.logger.error(`Token version mismatch for user ID ${user.id}, email ${payload.email}`);
            throw new UnauthorizedException('Token invalidated. Please sign in again.');
        }

        const subscription = await this.dbUtilsService.getUserSubscription(user.id);
        const subIsActive = subscription ? this.subscriptionService.isSubscriptionActive(subscription) : false;

        const userWithSubscription = {
            ...user,
            hasActiveSubscription: subIsActive,
            subscription: subscription || null,
        };

        await this.userCacheService.cacheUser(userWithSubscription);

        return userWithSubscription;
    }

}