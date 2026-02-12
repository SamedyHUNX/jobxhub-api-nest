import { IsOptional, IsString, IsBoolean, IsInt, IsUrl, Min, MinLength, MaxLength, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOrganizationDto {
    @ApiPropertyOptional()
    @IsUUID()
    orgId: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    orgName?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MinLength(10)
    @MaxLength(500)
    description?: string;
}
