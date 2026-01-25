import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  orgName: string;

  @IsString()
  @IsNotEmpty()
  slug: string;
}
