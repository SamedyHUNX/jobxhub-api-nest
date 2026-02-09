import { RateLimitCacheService } from "@/cache/services/rate-limit-cache.service";
import { ConfigService } from "@/common/services/config.service";
import { TokenService } from "@/common/services/token.service";
import { UserTable } from "@/drizzle/schema";
import { DrizzleHealthService } from "@/drizzle/services/drizzle-health.service";
import { InngestHealthService } from "@/inngest/services/inngest-health.service";
import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { eq } from "drizzle-orm";
import * as Sentry from "@sentry/nestjs"
import { UtilsService } from "@/common/services/utils.service";

@Injectable()
export class ForgotPasswordService {
    private logger = new Logger(ForgotPasswordService.name)
    constructor(private rateLimitCacheService: RateLimitCacheService, private dbService: DrizzleHealthService, private tokenService: TokenService, private readonly configService: ConfigService, private inngestService: InngestHealthService, private utilsService: UtilsService) { }

    async forgotPassword(
        email: string,
        acceptLanguage: string,
        ipAddress: string,
    ) {
        const startTime = Date.now();
        let userExists = false;
        let shouldSendEmail = false;

        try {
            // 1. Rate limit by IP (global)
            const ipAttempts =
                await this.rateLimitCacheService.incrementPasswordResetIpAttempts(
                    ipAddress,
                );

            if (ipAttempts > 3) {
                this.logger.warn(
                    `Too many password reset requests from IP: ${ipAddress}`,
                );

                // Add artificial delay before throwing to prevent timing analysis
                await this.rateLimitCacheService.addConstantTimeDelay(startTime);

                throw new HttpException(
                    'Too many requests',
                    HttpStatus.TOO_MANY_REQUESTS,
                );
            }

            // 2. Rate limit by email
            const emailAttempts =
                await this.rateLimitCacheService.incrementPasswordResetEmailAttempts(
                    email,
                );
            const emailRateLimited = emailAttempts > 3;

            // Find user by email (always execute)
            const [user] = await this.dbService.getDb()
                .select()
                .from(UserTable)
                .where(eq(UserTable.email, email))
                .limit(1);

            userExists = !!user;

            // Determine if we should actually send email
            shouldSendEmail =
                userExists &&
                !emailRateLimited &&
                (!user.resetPasswordExpires ||
                    user.resetPasswordExpires <= new Date(Date.now() - 300000));

            // Always generate token (even if not used) to maintain constant time
            const {
                token: resetToken,
                hashedToken,
                expiresAt,
            } = this.tokenService.generateAndHashToken(15);

            // Update database if user exists and should send email
            if (shouldSendEmail) {
                await this.dbService.getDb()
                    .update(UserTable)
                    .set({
                        resetPasswordToken: hashedToken,
                        resetPasswordExpires: expiresAt,
                    })
                    .where(eq(UserTable.id, user.id));

                const publicUrl = this.configService.publicUrl;
                if (!publicUrl) {
                    this.logger.error('CLIENT_URLS is not configured');
                    throw new HttpException(
                        'Server configuration error',
                        HttpStatus.INTERNAL_SERVER_ERROR,
                    );
                }

                const resetUrl = `${publicUrl}/${acceptLanguage}/reset-password?token=${resetToken}`;

                // Send email asynchronously (to maintain timing)
                this.inngestService.getInngest()
                    .send({
                        name: 'jobxhub/user.reset_password',
                        data: {
                            email,
                            resetUrl,
                            acceptLanguage,
                        },
                    })
                    .then(() => {
                        this.logger.log(`Successfully queued password reset email for ${email}`);
                    })
                    .catch((error) => {
                        this.logger.error(`Failed to queue password reset email for ${email}:`, error);
                        Sentry.captureException(error, {
                            tags: {
                                operation: 'password_reset',
                                email_sent: 'false',
                            },
                            extra: {
                                email,
                                acceptLanguage,
                            },
                        });
                    });
            }

            // Log different scenarios to Sentry for monitoring
            if (!userExists) {
                this.logger.warn(
                    `Password reset requested for non-existent email: at ${this.utilsService.getTimestamp()}`,
                );
                Sentry.captureMessage('Password reset for non-existent email', {
                    level: 'warning',
                    tags: {
                        operation: 'password_reset',
                        user_exists: 'false',
                    },
                    extra: {
                        email,
                        ipAddress,
                    },
                });
            } else if (emailRateLimited) {
                this.logger.warn(`Rate limit exceeded for email: ${email}`);
                Sentry.captureMessage('Password reset rate limit exceeded', {
                    level: 'warning',
                    tags: {
                        operation: 'password_reset',
                        rate_limited: 'true',
                    },
                    extra: {
                        email,
                        ipAddress,
                        attempts: emailAttempts,
                    },
                });
            }

            // Add constant-time delay to normalize response time
            await this.rateLimitCacheService.addConstantTimeDelay(startTime);

            // Always return same response
            return true
        } catch (error) {
            // Capture unexpected errors in Sentry
            if (!(error instanceof HttpException)) {
                Sentry.captureException(error, {
                    tags: {
                        operation: 'password_reset',
                    },
                    extra: {
                        email,
                        ipAddress,
                        acceptLanguage,
                    },
                });
            }

            throw error;
        }
    };
}