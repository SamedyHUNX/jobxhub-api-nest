import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InngestHealthService } from "../inngest-health.service";
import { EmailService } from "@/common/services/email.service";
import * as Sentry from '@sentry/node';

@Injectable()
export class AuthFunctions implements OnModuleInit {
    private createUserFn;
    private forgotPasswordFn;
    private readonly logger = new Logger(AuthFunctions.name);

    constructor(
        private readonly inngestService: InngestHealthService,
        private readonly emailService: EmailService,
    ) { }

    onModuleInit() {
        this.createUserFn = this.inngestService.getInngest().createFunction(
            { id: 'jobxhub/create-db-user', name: 'JobXHub - Create DB User' },
            { event: 'jobxhub/user.created' },
            async ({ event, step }) => {
                const { userId, email, acceptLanguage, verificationUrl } = event.data;

                this.logger.log(`Processing user.created event for userId: ${userId}, email: ${email}`);

                try {
                    await step.run('send-verification-email', async () => {
                        this.logger.log(`Sending verification email for userId: ${userId}, email: ${email}`);
                        await this.emailService.sendVerificationEmail(
                            email,
                            verificationUrl,
                            acceptLanguage,
                        );
                        this.logger.log(`Verification email sent successfully for userId: ${userId}`);
                        return { emailSent: true };
                    });

                    this.logger.log(`User created function completed successfully for userId: ${userId}`);
                    return { success: true, userId };
                } catch (error: any) {
                    this.logger.error(
                        `Failed to process user.created event for userId: ${userId}, email: ${email}`,
                        error?.stack || error,
                    );
                    Sentry.captureException(error, {
                        tags: {
                            operation: 'inngest_user_created',
                            function: 'create-db-user',
                        },
                        extra: {
                            userId,
                            email,
                            acceptLanguage,
                            errorMessage: error?.message,
                        },
                    });
                    throw error;
                }
            },
        );
        this.forgotPasswordFn = this.inngestService.getInngest().createFunction(
            { id: 'jobxhub/user.reset_password', name: 'JobXHub - Handle Password Reset Request' },
            { event: 'jobxhub/user.reset_password' },
            async ({ event, step }) => {
                const { email, resetUrl, acceptLanguage } = event.data;

                this.logger.log(`Processing password reset event for email: ${email}`);

                try {
                    await step.run('send-password-reset-email', async () => {
                        this.logger.log(`Sending password reset email for: ${email}`);
                        await this.emailService.sendPasswordResetEmail(
                            email,
                            resetUrl,
                            acceptLanguage,
                        );
                        this.logger.log(`Password reset email sent successfully for: ${email}`);
                        return { emailSent: true };
                    });

                    this.logger.log(`Password reset function completed successfully for: ${email}`);
                    return { success: true, email };
                } catch (error: any) {
                    this.logger.error(
                        `Failed to process password reset event for email: ${email}`,
                        error?.stack || error,
                    );
                    Sentry.captureException(error, {
                        tags: {
                            operation: 'inngest_password_reset',
                            function: 'user.reset_password',
                        },
                        extra: {
                            email,
                            acceptLanguage,
                            errorMessage: error?.message,
                        },
                    });
                    throw error;
                }
            },
        );
    }

    getFunctions() {
        return [this.createUserFn, this.forgotPasswordFn];
    }
}