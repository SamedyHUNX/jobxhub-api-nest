import { IsString, IsNumber, Min, Max } from 'class-validator';

export class SaveApplicantRankingDto {
    @IsString()
    userId: string;

    @IsString()
    jobId: string;

    @IsNumber()
    @Min(1)
    @Max(10)
    rating: number;
}