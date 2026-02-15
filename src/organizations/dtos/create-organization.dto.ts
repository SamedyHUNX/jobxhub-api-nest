import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  orgName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  orgDescription: string;

  @IsString()
  @IsNotEmpty()
  orgSlug: string;
}
