import {
    experienceLevels,
    jobListingTypes,
    locationRequirements,
    wageIntervals,
} from "@/drizzle/schema"
import { createAgent, createTool } from "@inngest/agent-kit"
import { anthropic } from "@inngest/agent-kit"
import { Injectable } from "@nestjs/common"
import { z } from "zod"

const listingSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    wage: z.number().nullable(),
    wageInterval: z.enum(wageIntervals).nullable(),
    stateAbbreviation: z.string().nullable(),
    city: z.string().nullable(),
    experienceLevel: z.enum(experienceLevels),
    type: z.enum(jobListingTypes),
    locationRequirement: z.enum(locationRequirements),
})

@Injectable()
export class JobMatchingAgentService {
    private returnMatchingJobsTool = (
        resolve: (jobIds: string[]) => void
    ) =>
        createTool({
            name: "return-matching-jobs",
            description: "Returns the list of matching job IDs to the caller",
            parameters: z.object({
                jobIds: z
                    .array(z.string())
                    .describe("List of job IDs that match the user prompt"),
            }),
            handler: async (input: { jobIds: string[] }) => {
                resolve(input.jobIds)
                return "Successfully returned matching job listings."
            },
        })

    public createJobMatchingAgent(
        jobListings: z.infer<typeof listingSchema>[],
        { maxNumberOfJobs }: { maxNumberOfJobs?: number } = {},
        resolve: (jobIds: string[]) => void
    ) {
        return createAgent({
            name: "job-matching-agent",
            description: "Agent for matching users with job listings",
            model: anthropic({
                model: "claude-sonnet-4-5",
                apiKey: process.env.ANTHROPIC_API_KEY,
                defaultParameters: { max_tokens: 1000, temperature: 0.7 },
            }),
            system: `You are an expert at matching people with jobs based on their specific experience, and requirements. The provided user prompt will be a description that can include information about themselves as well what they are looking for in a job. ${maxNumberOfJobs
                    ? `You are to return up to ${maxNumberOfJobs} jobs.`
                    : `Return all jobs that match their requirements.`
                } Use the return-matching-jobs tool to return the matching job IDs. If no jobs match, call the tool with an empty array. Here is the JSON array of available job listings: ${JSON.stringify(
                    jobListings.map(listing =>
                        listingSchema
                            .transform(listing => ({
                                ...listing,
                                wage: listing.wage ?? undefined,
                                wageInterval: listing.wageInterval ?? undefined,
                                city: listing.city ?? undefined,
                                stateAbbreviation: listing.stateAbbreviation ?? undefined,
                                locationRequirement: listing.locationRequirement ?? undefined,
                            }))
                            .parse(listing)
                    )
                )}`,
            tools: [this.returnMatchingJobsTool(resolve)],
        })
    }

    public async getMatchingJobListings(
        prompt: string,
        jobListings: z.infer<typeof listingSchema>[],
        options: { maxNumberOfJobs?: number } = {}
    ): Promise<string[]> {
        return new Promise(async resolve => {
            const agent = this.createJobMatchingAgent(jobListings, options, resolve)
            await agent.run(prompt)
            resolve([]) // fallback if tool is never called
        })
    }
}