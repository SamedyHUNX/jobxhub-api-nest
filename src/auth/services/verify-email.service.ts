import { TokenService } from "@/common/services/token.service";
import { UserTable } from "@/drizzle/schema";
import { DrizzleHealthService } from "@/drizzle/services/drizzle-health.service";
import { BadRequestException, Injectable, InternalServerErrorException, Logger, UnauthorizedException } from "@nestjs/common";
import { and, eq, gt } from "drizzle-orm";
import * as Sentry from "@sentry/nestjs"
import { InngestHealthService } from "@/inngest/services/inngest-health.service";

@Injectable()
export class VerifyEmailService {
    private logger = new Logger(VerifyEmailService.name)
    constructor(private tokenService: TokenService, private dbService: DrizzleHealthService, private inngest: InngestHealthService) { }

    async verifyEmail(token: string) {
        if (!token) {
            throw new BadRequestException('Invalid token');
        }

        const hashedToken = this.tokenService.createHash(token)

        const [user] = await this.dbService.getDb().select().from(UserTable).where(and(eq(UserTable.verificationToken, hashedToken),
            gt(UserTable.verificationExpires, new Date()))).limit(1)

        if (!user) {
            this.logger.warn(
                `Failed email verification attempt with token: ${token.substring(0, 8)}...`,
            );

            // Check if it's an expired token (user exists but token expired)
            const [expiredUser] = await this.dbService.getDb()
                .select()
                .from(UserTable)
                .where(eq(UserTable.verificationToken, hashedToken))
                .limit(1);

            if (expiredUser) {
                // Token exists but expired - option to resend
                throw new UnauthorizedException(
                    'Verification token has expired. Please request a new verification email',
                );
            }

            throw new UnauthorizedException('Invalid or expired verification token');
        }

        // Check if already verified (prevent replay attacks)
        if (user.isVerified) {
            this.logger.warn(
                `Attempt to verify already verified email: ${user.email}`,
            );
            return {
                message: 'Email already verified',
            };
        }

        try {
            await this.dbService.getDb()
                .update(UserTable)
                .set({
                    isVerified: true,
                    verificationToken: null,
                    verificationExpires: null,
                })
                .where(eq(UserTable.id, user.id));

            this.logger.log(`Email successfully verified for user ID: ${user.id}`);

            // Send welcome email or trigger onboarding
            try {
                await this.inngest.getInngest().send({
                    name: 'jobxhub/user.verified',
                    data: {
                        userId: user.id,
                        email: user.email,
                    },
                })
            } catch (inngestError) {
                // Don't fail verification if event fails, just log it
                Sentry.captureException(inngestError, {
                    extra: {
                        userId: user.id,
                        email: user.email,
                        context: 'email_verification_event_failed',
                    },
                });
                this.logger.error(
                    `Failed to emit user.verified event: ${inngestError?.message}`,
                );
            }

            return true
        } catch (error) {
            Sentry.captureException(error, {
                extra: {
                    userId: user.id,
                    email: user.email,
                    context: 'email_verification_update_failed',
                },
            });
            this.logger.error(
                `Failed to update verification status: ${error?.message}`,
            );
            throw new InternalServerErrorException(
                'Failed to verify email. Please try again',
            );
        }
    }
}