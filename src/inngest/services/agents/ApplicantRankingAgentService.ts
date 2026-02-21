import { Injectable } from '@nestjs/common';
import { createAgent, createTool } from '@inngest/agent-kit';
import { z } from 'zod';
import { DatabaseUtilsService } from '@/common/services/database-utils.service';
import { anthropic } from 'inngest';
import { ConfigService } from '@/common/services/config.service';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class ApplicantRankingAgentService {
    private anthropic: Anthropic;

    constructor(private readonly dbUtilService: DatabaseUtilsService, private readonly configService: ConfigService) { }

    private saveApplicantRatingTool = createTool({
        name: 'save-applicant-ranking',
        description: "Saves the applicant's ranking for a specific job listing in the database",
        parameters: z.object({
            userId: z.string().describe('The ID of the user/applicant'),
            jobId: z.string().describe('The ID of the job listing'),
            rating: z.number().min(1).max(10).describe('Rating from 1-10 on how well the applicant fits the job'),
        }),
        handler: async (input: { userId: string; jobId: string; rating: number }) => {
            await this.dbUtilService.updateJobListingApplication(
                input.jobId,
                input.userId,
                { rating: input.rating },
            );
            return "Successfully saved the applicant's ranking for the job listing.";
        },
    });

    public applicantRankingAgent = createAgent({
        name: 'applicant-ranking-agent',
        description: 'Applicant Ranking Agent',
        model: anthropic({ model: 'claude-sonnet-4-5', apiKey: process.env.ANTHROPIC_API_KEY, defaultParameters: { max_tokens: 1000, temperature: 0.7, }, }),
        system: `
    You are an expert in hiring and recruitment. Your task is to evaluate a candidate's application for a specific job opening.

    You will receive the following information:
    - coverLetter: The candidate's cover letter.
    - resumeSummary: A summary of the candidate's resume.
    - jobListing: The job description.
    - userId: The ID of the user.

    Your task is to compare the job listing with the applicant's resume and cover letter and provide a rating for the applicant
    on how well they fit that specific job listing. The rating should be a number between 1 and 10, where 10 is the highest rating
    indicating a perfect or near perfect match. A rating of 5 should be used for applicants that barely meet the requirements of 
    the job listing, while a rating of 1 should be used for applicants that do not meet the requrements at all. You should save
    this user rating in the database and not return any output.
    `,
        tools: [this.saveApplicantRatingTool],
    });
}
