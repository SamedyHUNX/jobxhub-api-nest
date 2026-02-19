import { UserCacheService } from "@/cache/services/user-cache.service";
import { UserTable } from "@/drizzle/schema";
import { DrizzleHealthService } from "@/drizzle/services/drizzle-health.service";
import { Injectable, Logger } from "@nestjs/common";
import { eq } from "drizzle-orm";
import * as Sentry from "@sentry/nestjs"
import { DatabaseUtilsService } from "@/common/services/database-utils.service";

@Injectable()
export class SignOutService {
    private logger = new Logger(SignOutService.name)
    constructor(private dbService: DrizzleHealthService, private userCacheService: UserCacheService, private readonly dbUtilsService: DatabaseUtilsService) { }

    async signOut(userId: string) {
        try {
            // 1. Get user data to clear cache properly
            const user = await this.dbUtilsService.findUserByUserIdOrEmail(userId, undefined);

            if (!user) {
                this.logger.warn(`Sign out attempted for non-existent user: ${userId}`);
                return true
            }

            // 2. Increment token version to invalidate all existing tokens
            await this.dbService.getDb()
                .update(UserTable)
                .set({
                    tokenVersion: user.tokenVersion + 1,
                })
                .where(eq(UserTable.id, userId));

            // 3. Clear user cache
            await this.userCacheService.clearUserById(user.id);
            await this.userCacheService.clearUserByEmail(user.email)
            // 4. Invalidate all sessions
            await this.userCacheService.invalidateAllSessions(user.id);

            // 5. Log the sign-out event
            this.logger.log(
                `User ${user.email} (ID: ${userId}) signed out successfully`,
            );

            return true
        } catch (error) {
            Sentry.captureException(error, {
                tags: {
                    operation: 'sign_out',
                },
                extra: {
                    userId,
                },
            });

            this.logger.error(`Sign out error for user ${userId}: ${error?.message}`);

            // Still return success
            return true
        }
    }
}