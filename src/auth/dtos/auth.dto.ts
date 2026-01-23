import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { Match } from '../../utils/decorators';

export class SignUpDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  username: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @Matches(/^(?=.*[A-Za-z])(?=.*[^A-Za-z0-9]).*$/, {
    message:
      'Password must contain at least one letter and one special character',
  })
  password: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @Match('password', { message: 'Passwords do not match' })
  confirmPassword: string;

  @IsString() @IsNotEmpty() firstName: string;
  @IsString() @IsNotEmpty() lastName: string;
  @IsDateString() @IsNotEmpty() dateOfBirth: string;
  @IsString() @IsNotEmpty() phoneNumber: string;
}

export class SignInDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RequestPasswordResetDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @Matches(/^(?=.*[A-Za-z])(?=.*[^A-Za-z0-9]).*$/, {
    message:
      'Password must contain at least one letter and one special character',
  })
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @Match('newPassword', { message: 'Passwords do not match' })
  confirmNewPassword: string;
}
