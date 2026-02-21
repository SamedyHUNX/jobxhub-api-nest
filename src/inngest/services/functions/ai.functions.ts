import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InngestHealthService } from "../inngest-health.service";
import { DatabaseUtilsService } from "@/common/services/database-utils.service";
import { ConfigService } from "@/common/services/config.service";
import Anthropic from "@anthropic-ai/sdk";
import { ApplicantRankingAgentService } from "../agents/ApplicantRankingAgentService";

@Injectable()
export class AiFunctions implements OnModuleInit {
    private readonly logger = new Logger(AiFunctions.name);
    private createAiSummaryOfUploadedResume;
    private rankApplication;
    private anthropic: Anthropic;

    constructor(
        private readonly inngestService: InngestHealthService,
        private readonly dbUtilsService: DatabaseUtilsService,
        private readonly configService: ConfigService,
        private readonly applicantRankingAgentService: ApplicantRankingAgentService,
    ) { }

    onModuleInit() {
        this.anthropic = new Anthropic({
            apiKey: this.configService.anthropicApiKey,
        });

        this.createAiSummaryOfUploadedResume = this.inngestService.getInngest().createFunction(
            { id: 'jobxhub/create-ai-summary-of-uploaded-resume', name: 'JobXHub - Create AI Summary of Uploaded Resume' },
            { event: 'jobxhub/resume.uploaded' },
            async ({ event, step }) => {
                const { userId } = event.data;

                const userResume = await step.run('get-user-resume', async () => {
                    return await this.dbUtilsService.getResumeByUserId(userId);
                });

                if (!userResume || userResume === null) return;

                const aiSummary = await step.run('create-ai-summary', async () => {
                    const response = await this.anthropic.messages.create({
                        model: 'claude-sonnet-4-5',
                        max_tokens: 2048,
                        messages: [
                            {
                                role: 'user',
                                content: [
                                    {
                                        type: 'document',
                                        source: {
                                            type: 'url',
                                            url: userResume.resumeFileUrl,
                                        },
                                    } as any,
                                    {
                                        type: 'text',
                                        text: "Summarize the following resume and extract all key skills, experience, and qualifications. The summary should include all the information that a hiring manager would need to know about the candidate in order to determine if they are a good fit for the job. This summary should be formatted in markdown. Do not return any other text. If the file does not look like a resume return the text with N/A",
                                    },
                                ],
                            },
                        ],
                    });

                    const message = response.content[0];
                    if (message.type !== 'text') return null;
                    return message.text;
                });

                if (!aiSummary) return;

                await step.run('save-ai-summary', async () => {
                    await this.dbUtilsService.updateResume(userId, {
                        aiSummary,
                    });
                });
            },
        );

        this.rankApplication = this.inngestService.getInngest().createFunction(
            { id: 'jobxhub/rank-application', name: 'JobXHub - Rank Application' },
            { event: 'jobxhub/job_listing_application.created' },
            async ({ event, step }) => {
                const { userId, jobId } = event.data;

                const getCoverLetter = step.run('get-cover-letter', async () => {
                    return await this.dbUtilsService.getCoverLetter(userId, jobId);
                });

                const getJobListing = step.run('get-job-listing', async () => {
                    return await this.dbUtilsService.getJobListingById(jobId);
                });


                const getUserResume = step.run('get-user-resume', async () => {
                    return await this.dbUtilsService.getResumeByUserId(userId);
                });

                const [coverLetter, jobListing, userResume] = await Promise.all([getCoverLetter, getJobListing, getUserResume]);

                const resumeSummary = userResume?.aiSummary;

                if (!coverLetter || !jobListing || !resumeSummary) return;

                await this.applicantRankingAgentService.applicantRankingAgent.run(JSON.stringify({ coverLetter, resumeSummary, jobListing, userId }))
            },
        );
    }

    getFunctions() {
        return [this.createAiSummaryOfUploadedResume, this.rankApplication];
    }
}
