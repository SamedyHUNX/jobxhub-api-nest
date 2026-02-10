import { UserCacheService } from "@/cache/services/user-cache.service";
import { UserSubscriptionsTable, UserTable } from "@/drizzle/schema";
import { DrizzleHealthService } from "@/drizzle/services/drizzle-health.service";
import { BadRequestException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { and, eq, gt, inArray } from "drizzle-orm";
import type { PayloadType } from "../jwt/types/jwt.types";

@Injectable()
export class ValidateUserService {
    private logger = new Logger(ValidateUserService.name)
    constructor(private userCacheService: UserCacheService, private dbService: DrizzleHealthService) { }

    async validateUser(payload: PayloadType) {
        if (!payload) {
            throw new BadRequestException('Invalid payload');
        }

        // Try to get user from cache first
        const cachedUser = await this.userCacheService.getUserByEmail(payload.email)

        if (cachedUser) {
            // Verify token version from cache
            if (payload.tokenVersion !== cachedUser.tokenVersion) {
                // Token version mismatch - clear cache and reject
                await this.userCacheService.clearUserById(cachedUser.id)
                this.logger.error(
                    `Token version mismatch for user ID ${cachedUser.id}. Token invalidated.`,
                );
                throw new UnauthorizedException(
                    'Token has been invalidated. Please sign in again.',
                );
            }

            return cachedUser;
        }

        // Cache miss - fetch from database
        const [user] = await this.dbService.getDb()
            .select()
            .from(UserTable)
            .where(eq(UserTable.id, payload.sub))
            .limit(1);

        if (!user) {
            this.logger.error(
                `User with ID ${payload.sub} not found during validation`,
            );
            throw new UnauthorizedException('User not found');
        }

        // Check if tokenVersion matches
        if (payload.tokenVersion !== user.tokenVersion) {
            this.logger.error(
                `Token version mismatch for user ID ${user.id}. Token invalidated.`,
            );
            throw new UnauthorizedException(
                'Token has been invalidated. Please sign in again.',
            );
        }

        // Fetch subscription info
        const [subscription] = await this.dbService.getDb()
            .select()
            .from(UserSubscriptionsTable)
            .where(and(
                eq(UserSubscriptionsTable.userId, user.id),
                inArray(UserSubscriptionsTable.status, ['active', 'trialing']),
                gt(UserSubscriptionsTable.currentPeriodEnd, new Date())
            ))
            .limit(1);


        const userWithSubscription = {
            ...user,
            hasSubscription: !!subscription,
            subscription: subscription || null,
        }

        // Cache user
        await this.userCacheService.cacheUser(userWithSubscription)

        return userWithSubscription;
    };
}