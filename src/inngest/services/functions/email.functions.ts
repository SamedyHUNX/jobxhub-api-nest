import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InngestHealthService } from "../inngest-health.service";
import * as Sentry from '@sentry/node';
import { EmailService } from "@/common/services/email.service";
import { DatabaseUtilsService } from "@/common/services/database-utils.service";

@Injectable()
export class EmailFunctions implements OnModuleInit {
    private readonly logger = new Logger(EmailFunctions.name);
    private prepareDailyUserJobListingNotifications;

    constructor(
        private readonly inngestService: InngestHealthService,
        private readonly emailService: EmailService,
        private readonly dbUtilsService: DatabaseUtilsService,
    ) { }

    onModuleInit() {
        this.prepareDailyUserJobListingNotifications = this.inngestService.getInngest().createFunction(
            { id: 'jobxhub/email.daily-user-job-listings', name: 'JobXHub - Email Daily User Job Listing Notifications' },
            { event: 'jobxhub/email.daily-user-job-listings' },
            async ({ event, step }) => {
                // Step 1: Fetch users with email notifications enabled and recent job listings in parallel
                const [userNotifications, jobListings] = await Promise.all([
                    step.run('get-users', async () => {
                        return await this.dbUtilsService.getUsersWithNotificationSettings();
                    }),
                    step.run('get-recent-job-listings', async () => {
                        return await this.dbUtilsService.getRecentJobListings();
                    }),
                ]);

                if (!jobListings?.length || !userNotifications?.length) {
                    this.logger.log('No users or job listings found, skipping daily notifications');
                    return { skipped: true };
                }

                // Step 2: Send an email for each user
                await step.run('send-daily-notifications', async () => {
                    const results = await Promise.allSettled(
                        userNotifications.map(async (notification) => {
                            const { userId, userEmail, userFirstName, userLastName, aiPrompt } = notification;

                            try {
                                this.logger.log(`Sending daily job listing notification to userId: ${userId} (${userEmail})`);

                                await this.emailService.sendDailyJobListingEmail({
                                    to: userEmail,
                                    firstName: userFirstName,
                                    lastName: userLastName,
                                    jobListings,
                                    aiPrompt,
                                });

                                this.logger.log(`Daily notification sent successfully to userId: ${userId}`);
                                return { userId, emailSent: true };
                            } catch (error: any) {
                                this.logger.error(
                                    `Failed to send daily notification to userId: ${userId}`,
                                    error?.stack || error,
                                );
                                Sentry.captureException(error, {
                                    tags: {
                                        operation: 'inngest_daily_user_job_listing_notifications',
                                        function: 'send-daily-notifications',
                                    },
                                    extra: {
                                        userId,
                                        userEmail,
                                        errorMessage: error?.message,
                                    },
                                });
                                return { userId, emailSent: false, error: error?.message };
                            }
                        }),
                    );

                    const succeeded = results.filter((r) => r.status === 'fulfilled' && (r.value as any).emailSent).length;
                    const failed = results.length - succeeded;

                    this.logger.log(`Daily notifications complete. Sent: ${succeeded}, Failed: ${failed}`);
                    return { total: results.length, succeeded, failed };
                });
            },
        );
    }

    getFunctions() {
        return [this.prepareDailyUserJobListingNotifications];
    }
}
