import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InngestHealthService } from "../inngest-health.service";
import * as Sentry from '@sentry/node';
import { EmailService } from "@/email/services/email.service";
import { DatabaseUtilsService } from "@/common/services/database-utils.service";
import { JobMatchingAgentService } from "@/agents/services/job-matching-agent.service";
import type { JobListing } from "@/types";

@Injectable()
export class EmailFunctions implements OnModuleInit {
    private readonly logger = new Logger(EmailFunctions.name);
    private prepareDailyUserJobListingNotifications;
    private sendDailyJobListingEmailToUser;
    private prepareDailyOrganizationUserApplicationNotifications;
    private sendDailyApplicationEmailToUser;

    constructor(
        private readonly inngestService: InngestHealthService,
        private readonly emailService: EmailService,
        private readonly dbUtilsService: DatabaseUtilsService,
        private readonly jobMatchingAgentService: JobMatchingAgentService
    ) { }

    onModuleInit() {
        this.prepareDailyUserJobListingNotifications = this.inngestService.getInngest().createFunction(
            { id: 'jobxhub/email.prepare-daily-user-job-listings', name: 'JobXHub - Prepare Daily User Job Listing Notifications' },
            { event: 'jobxhub/email.prepare-daily-user-job-listings' },
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
                    matchingJobListings = jobListings.filter((listing: JobListing) => matchingIds.includes(listing.id));
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

                        this.logger.log(`Daily email sent successfully to userId: ${userId} `);
                        return { emailSent: true };
                    });

                    return { success: true, userId };
                } catch (error: any) {
                    this.logger.error(
                        `Failed to send daily notification to userId: ${userId} `,
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

        // Orchestrator: fetches recent applications for an org and fans out one event per user
        this.prepareDailyOrganizationUserApplicationNotifications = this.inngestService.getInngest().createFunction(
            { id: 'jobxhub/prepare-daily-organization-user-application-notifications', name: 'JobXHub - Prepare Daily Organization User Application Notifications' },
            { event: 'jobxhub/prepare-daily-organization-user-application-notifications' },
            async ({ event, step }) => {
                const { organizationId } = event.data;

                const [users, applications] = await Promise.all([
                    step.run('get-org-users', async () => {
                        return await this.dbUtilsService.getOrgUsersWithApplicationNotificationSettings(organizationId);
                    }),
                    step.run('get-recent-applications', async () => {
                        return await this.dbUtilsService.getRecentApplications(organizationId);
                    }),
                ]);

                if (!users?.length) {
                    this.logger.log('No users found, skipping daily notifications');
                    return { skipped: true };
                }

                if (!applications?.length) {
                    this.logger.log('No applications found, skipping daily notifications');
                    return { skipped: true };
                }

                // Build a lookup map: userId -> user notification settings
                const userMap = new Map(users.map(u => [u.userId, u]));

                // Group applications by userId (only those who opted in)
                const groupedApplications = applications.reduce<Record<string, typeof applications>>((acc, application) => {
                    if (!userMap.has(application.userId)) return acc; // user hasn't opted in
                    if (!acc[application.userId]) {
                        acc[application.userId] = [];
                    }
                    acc[application.userId].push(application);
                    return acc;
                }, {});

                // Fan out: one event per user, each with only their relevant applications
                const events = Object.entries(groupedApplications)
                    .map(([userId, userApplications]) => {
                        const user = userMap.get(userId);
                        if (!user) return null;

                        return {
                            name: 'jobxhub/email.send-daily-application' as const,
                            data: {
                                userId,
                                userEmail: user.userEmail,
                                userFirstName: user.userFirstName,
                                userLastName: user.userLastName,
                                applications: userApplications,
                            },
                        };
                    })
                    .filter((e): e is NonNullable<typeof e> => e !== null);

                if (!events.length) {
                    this.logger.log('No matched user-application pairs, skipping dispatch');
                    return { skipped: true };
                }

                await step.sendEvent('dispatch-daily-application-emails', events);

                this.logger.log(`Dispatched ${events.length} daily application notification emails.`);
                return { dispatched: events.length };
            }
        );

        // Worker: sends the daily application summary email to a single user
        this.sendDailyApplicationEmailToUser = this.inngestService.getInngest().createFunction(
            {
                id: 'jobxhub/email.send-daily-application',
                name: 'JobXHub - Send Daily Application Email To User',
                throttle: {
                    limit: 10,
                    period: '1m',
                },
            },
            { event: 'jobxhub/email.send-daily-application' },
            async ({ event, step }) => {
                const { userId, userEmail, userFirstName, userLastName, applications } = event.data;

                if (!applications?.length) return { skipped: true };

                try {
                    await step.run('send-daily-application-email', async () => {
                        this.logger.log(`Sending daily application notification to userId: ${userId} (${userEmail})`);

                        await this.emailService.sendDailyApplicationEmail({
                            to: userEmail,
                            firstName: userFirstName,
                            lastName: userLastName,
                            applications,
                        });

                        this.logger.log(`Daily application email sent successfully to userId: ${userId}`);
                        return { emailSent: true };
                    });

                    return { success: true, userId };
                } catch (error: any) {
                    this.logger.error(
                        `Failed to send daily application notification to userId: ${userId}`,
                        error?.stack || error,
                    );
                    Sentry.captureException(error, {
                        tags: {
                            operation: 'inngest_send_daily_application_email',
                            function: 'send-daily-application',
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
        return [
            this.prepareDailyUserJobListingNotifications,
            this.sendDailyJobListingEmailToUser,
            this.prepareDailyOrganizationUserApplicationNotifications,
            this.sendDailyApplicationEmailToUser,
        ];
    }
}
