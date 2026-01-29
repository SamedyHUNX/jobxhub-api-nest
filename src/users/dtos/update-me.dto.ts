import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class UpdatedMeDataDto {
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(10)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'usernameInvalid' })
  username?: string;

  @IsString()
  @IsOptional()
  @MinLength(1, { message: 'firstNameRequired' })
  firstName?: string;

  @IsString()
  @IsOptional()
  @MinLength(1, { message: 'lastNameRequired' })
  lastName?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'phoneNumberInvalid' })
  phoneNumber?: string;
}
