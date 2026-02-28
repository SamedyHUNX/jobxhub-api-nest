import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InngestHealthService } from "../inngest-health.service";
import * as Sentry from '@sentry/node';
import { EmailService } from "@/common/services/email.service";
import { DatabaseUtilsService } from "@/common/services/database-utils.service";
import { JobMatchingAgentService } from "@/agents/services/job-matching-agent.service";

@Injectable()
export class EmailFunctions implements OnModuleInit {
    private readonly logger = new Logger(EmailFunctions.name);
    private prepareDailyUserJobListingNotifications;
    private sendDailyJobListingEmailToUser;

    constructor(
        private readonly inngestService: InngestHealthService,
        private readonly emailService: EmailService,
        private readonly dbUtilsService: DatabaseUtilsService,
        private readonly jobMatchingAgentService: JobMatchingAgentService
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

                // Step 2: Fan out! Send an event for each user to be processed in parallel
                await step.sendEvent(
                    'dispatch-daily-emails',
                    userNotifications.map((notification) => ({
                        name: 'jobxhub/email.send-daily-job-listing',
                        data: {
                            userId: notification.userId,
                            userEmail: notification.userEmail,
                            userFirstName: notification.userFirstName,
                            userLastName: notification.userLastName,
                            aiPrompt: notification.aiPrompt,
                            jobListings,
                        },
                    })),
                );

                this.logger.log(`Dispatched ${userNotifications.length} daily job listing emails.`);
                return { dispatched: userNotifications.length };
            },
        );

        this.sendDailyJobListingEmailToUser = this.inngestService.getInngest().createFunction(
            {
                id: 'jobxhub/email.send-daily-job-listing', name: 'JobXHub - Send Daily Job Listing Email To User', throttle: {
                    limit: 10,
                    period: '1m'
                }
            },
            { event: 'jobxhub/email.send-daily-job-listing' },
            async ({ event, step }) => {
                const { userId, userEmail, userFirstName, userLastName, aiPrompt, jobListings } = event.data;

                if (!jobListings?.length) return { skipped: true };

                let matchingJobListings: typeof jobListings = [];

                if (aiPrompt === null || aiPrompt.trim() === "") {
                    matchingJobListings = jobListings
                } else {
                    const matchingIds = await this.jobMatchingAgentService.getMatchingJobListings(aiPrompt, jobListings);
                    matchingJobListings = jobListings.filter((listing) => matchingIds.includes(listing.id));
                }

                if (matchingJobListings.length === 0) return { skipped: true };

                try {
                    await step.run('send-daily-email', async () => {
                        this.logger.log(`Sending daily job listing notification to userId: ${userId} (${userEmail})`);

                        await this.emailService.sendDailyJobListingEmail({
                            to: userEmail,
                            firstName: userFirstName,
                            lastName: userLastName,
                            jobListings: matchingJobListings,
                            aiPrompt,
                        });

                        this.logger.log(`Daily email sent successfully to userId: ${userId}`);
                        return { emailSent: true };
                    });

                    return { success: true, userId };
                } catch (error: any) {
                    this.logger.error(
                        `Failed to send daily notification to userId: ${userId}`,
                        error?.stack || error,
                    );
                    Sentry.captureException(error, {
                        tags: {
                            operation: 'inngest_send_daily_job_listing_email',
                            function: 'send-daily-notification',
                        },
                        extra: {
                            userId,
                            userEmail,
                            errorMessage: error?.message,
                        },
                    });
                    throw error; // Throw so that Inngest specifically retries this run
                }
            }
        );
    }

    getFunctions() {
        return [this.prepareDailyUserJobListingNotifications, this.sendDailyJobListingEmailToUser];
    }
}
