import { Module } from "@nestjs/common";
import { ApplicantRankingAgentService } from "./services/applicant-ranking-agent.service";
import { JobMatchingAgentService } from "./services/job-matching-agent.service";
import { CommonModule } from "@/common/common.module";

@Module({
    imports: [CommonModule],
    controllers: [],
    providers: [ApplicantRankingAgentService, JobMatchingAgentService],
    exports: [ApplicantRankingAgentService, JobMatchingAgentService],
})
export class AgentsModule { }