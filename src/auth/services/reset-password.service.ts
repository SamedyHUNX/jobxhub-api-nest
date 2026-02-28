import { UserCacheService } from "@/cache/services/user-cache.service";
import { HashingService } from "@/common/services/hashing.service";
import { TokenService } from "@/common/services/token.service";
import { UserTable } from "@/drizzle/schema";
import { DrizzleHealthService } from "@/drizzle/services/drizzle-health.service";
import { BadRequestException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { and, eq, gt } from "drizzle-orm";

@Injectable()
export class ResetPasswordService {
    private logger = new Logger(ResetPasswordService.name)
    constructor(private tokenService: TokenService, private dbService: DrizzleHealthService, private hashingService: HashingService, private userCacheService: UserCacheService) { }

    async resetPassword(
        token: string,
        newPassword: string,
        confirmPassword: string,
    ) {
        if (newPassword !== confirmPassword) {
            this.logger.error(`User provided non-matching passwords`);
            throw new BadRequestException('Passwords must match');
        }

        // Hash the token from URL to compare with stored hash
        const hashedToken = this.tokenService.createHash(token);

        // Find user by reset token and check expiration
        const [user] = await this.dbService.getDb()
            .select()
            .from(UserTable)
            .where(
                and(
                    eq(UserTable.resetPasswordToken, hashedToken),
                    gt(UserTable.resetPasswordExpires, new Date()),
                ),
            )
            .limit(1);

        if (!user) {
            this.logger.error('Invalid or expired password reset token used');
            throw new UnauthorizedException('Invalid or expired verification token');
        }

        // Hash new password
        const hashedPassword = await this.hashingService.hash(newPassword);

        // Update user's password and clear reset token fields
        await this.dbService.getDb()
            .update(UserTable)
            .set({
                password: hashedPassword,
                resetPasswordToken: null,
                resetPasswordExpires: null,
                tokenVersion: user.tokenVersion + 1,
            })
            .where(eq(UserTable.id, user.id));

        // Invalidate all cached user data
        await this.userCacheService.invalidateUser(user.id)

        // Invalidate all active sessions for this user
        await this.userCacheService.invalidateAllSessions(user.id);

        this.logger.log(`Password successfully reset for user ID: ${user.id}`);
        return true
    };
}