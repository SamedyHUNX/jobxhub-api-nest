import { UserCacheService } from "@/cache/services/user-cache.service";
import { UserTable } from "@/drizzle/schema";
import { DrizzleHealthService } from "@/drizzle/services/drizzle-health.service";
import { BadRequestException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { eq } from "drizzle-orm";

@Injectable()
export class ValidateUserService {
    private logger = new Logger(ValidateUserService.name)
    constructor(private userCacheService: UserCacheService, private dbService: DrizzleHealthService) { }

    async validateUser(payload: any) {
        if (!payload) {
            throw new BadRequestException('Invalid payload');
        }

        // Try to get user from cache first
        const cachedUser = await this.userCacheService.getUserById(payload.sub)

        if (cachedUser) {
            // Verify token version from cache
            if (payload.tokenVersion !== cachedUser.tokenVersion) {
                // Token version mismatch - clear cache and reject
                await this.userCacheService.clearUser(cachedUser)
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

        // Cache the user for future requests
        await this.userCacheService.setUser(user)

        return user;
    };
}