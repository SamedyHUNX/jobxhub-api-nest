import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InngestHealthService } from "../inngest-health.service";
import * as Sentry from '@sentry/node';
import { DatabaseUtilsService } from "@/common/services/database-utils.service";
import { ConfigService } from "@/common/services/config.service";
import Anthropic from "@anthropic-ai/sdk";

@Injectable()
export class AiFunctions implements OnModuleInit {
    private readonly logger = new Logger(AiFunctions.name);
    private createAiSummaryOfUploadedResume;
    private anthropic: Anthropic;

    constructor(
        private readonly inngestService: InngestHealthService,
        private readonly dbUtilsService: DatabaseUtilsService,
        private readonly configService: ConfigService
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
    }

    getFunctions() {
        return [this.createAiSummaryOfUploadedResume];
    }
}
