import { HashingService } from "@/common/services/hashing.service";
import { DrizzleHealthService } from "@/drizzle/services/drizzle-health.service";
import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { SignInDto } from "../dto/auth.dto";
import type { User } from "@/types";
import { ConfigService } from "@/common/services/config.service";
import { RateLimitCacheService } from "@/cache/services/rate-limit-cache.service";
import { UserTable } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import * as Sentry from '@sentry/node';
import { UserCacheService } from "@/cache/services/user-cache.service";
import { JwtService } from '@nestjs/jwt';
import { CachedUser } from "@/cache/types/cache.types";
import { DatabaseUtilsService } from "@/common/services/database-utils.service";
import { SubscriptionPermissionsService } from "@/permissions/services/subscription-permissions.service";

@Injectable()
export class SignInService {
    private readonly logger = new Logger(SignInService.name);

    constructor(
        private readonly dbService: DrizzleHealthService,
        private readonly hashingService: HashingService,
        private readonly configService: ConfigService,
        private readonly userCacheService: UserCacheService,
        private readonly rateLimitCache: RateLimitCacheService,
        private readonly jwtService: JwtService,
        private readonly dbUtilsService: DatabaseUtilsService,
        private readonly subscriptionService: SubscriptionPermissionsService
    ) {
    }

    async signIn(data: SignInDto, ipAddress: string, user: User) {
        if (user) {
            throw new UnauthorizedException('User already signed in');
        }
        const { email, password } = data;
        const startTime = Date.now();

        try {
            if (this.configService.isProduction) {
                // 1. Check IP-based rate limiting (global protection)
                await this.rateLimitCache.checkIpRateLimit(ipAddress);

                // 2. Check email-based rate limiting (account protection)
                await this.rateLimitCache.checkEmailRateLimit(email);

                // 3. Check for account lockout
                const isLocked = await this.rateLimitCache.isAccountLocked(email);

                if (isLocked) {
                    await this.rateLimitCache.addConstantTimeDelay(startTime);
                    throw new UnauthorizedException(
                        'Account temporarily locked due to multiple failed login attempts. Please try again later or reset your password.',
                    );
                }
            }

            const cachedUser = await this.userCacheService.getUserByEmail(email)

            let user: CachedUser;
            let passwordHash: string;

            if (cachedUser) {
                // Get user from cache
                user = cachedUser;

                const [dbStatus] = await this.dbService.getDb()
                    .select({
                        isBanned: UserTable.isBanned,
                        isDisabled: UserTable.isDisabled,
                        isVerified: UserTable.isVerified,
                        tokenVersion: UserTable.tokenVersion,
                        password: UserTable.password,
                    })
                    .from(UserTable)
                    .where(eq(UserTable.email, email))
                    .limit(1);

                if (!dbStatus) {
                    await this.rateLimitCache.handleFailedLogin(email, ipAddress, 'user_not_found');
                    await this.rateLimitCache.addConstantTimeDelay(startTime);
                    throw new UnauthorizedException('Invalid credentials');
                }

                if (dbStatus.isBanned) {
                    await this.rateLimitCache.addConstantTimeDelay(startTime);
                    throw new UnauthorizedException('Account has been banned');
                }

                if (dbStatus.isDisabled) {
                    await this.rateLimitCache.addConstantTimeDelay(startTime);
                    throw new UnauthorizedException('Account has been disabled');
                }

                if (!dbStatus.isVerified) {
                    await this.rateLimitCache.addConstantTimeDelay(startTime);
                    throw new UnauthorizedException(
                        'Account is not verified. Please check your inbox to verify',
                    );
                }

                const { password: dbPassword, ...status } = dbStatus;
                passwordHash = dbPassword;
                user = { ...user, ...status };

                await this.userCacheService.cacheUser(user)
            } else {
                const dbUser = await this.dbUtilsService.findUserByUserIdOrEmail(undefined, email);

                if (!dbUser) {
                    await this.rateLimitCache.handleFailedLogin(email, ipAddress, 'user_not_found');
                    await this.rateLimitCache.addConstantTimeDelay(startTime);
                    throw new UnauthorizedException('Invalid credentials');
                }

                if (dbUser.isBanned) {
                    await this.rateLimitCache.addConstantTimeDelay(startTime);
                    throw new UnauthorizedException('Account has been banned');
                }

                if (dbUser.isDisabled) {
                    await this.rateLimitCache.addConstantTimeDelay(startTime);
                    throw new UnauthorizedException('Account has been disabled');
                }

                if (!dbUser.isVerified) {
                    await this.rateLimitCache.addConstantTimeDelay(startTime);
                    throw new UnauthorizedException(
                        'Account is not verified. Please check your inbox to verify',
                    );
                }

                passwordHash = dbUser.password;
                user = dbUser;
            }

            const isPasswordValid = await this.hashingService.verify(passwordHash, password);

            if (!isPasswordValid) {
                await this.rateLimitCache.handleFailedLogin(email, ipAddress, 'invalid_password');
                await this.rateLimitCache.addConstantTimeDelay(startTime);
                throw new UnauthorizedException('Invalid credentials');
            }

            const subscription = await this.dbUtilsService.getUserSubscription(user.id);
            const subIsActive = subscription ? this.subscriptionService.isSubscriptionActive(subscription) : false;

            const userWithSubscription = {
                ...user,
                hasActiveSubscription: subIsActive,
                subscription: subscription || null,
            };

            await this.userCacheService.cacheUser(userWithSubscription)

            // Successful login - clear failed attempts
            await this.rateLimitCache.clearFailedAttempts(email, ipAddress);

            const payload = {
                email: user.email,
                sub: user.id,
                tokenVersion: user.tokenVersion,
            };

            const token = this.jwtService.sign(payload);

            // Log successful login
            this.logger.log(`Successful login for user: ${email}`);

            await this.rateLimitCache.addConstantTimeDelay(startTime);

            return token
        } catch (error) {
            // Capture security-related errors in Sentry
            if (error instanceof UnauthorizedException) {
                Sentry.captureMessage('Failed login attempt', {
                    level: 'warning',
                    tags: {
                        operation: 'sign_in',
                        error_type: error.message,
                    },
                    extra: {
                        email,
                        ipAddress,
                    },
                });
            } else {
                Sentry.captureException(error, {
                    tags: {
                        operation: 'sign_in',
                    },
                    extra: {
                        email,
                        ipAddress,
                    },
                });
            }

            throw error;
        }
    }
}