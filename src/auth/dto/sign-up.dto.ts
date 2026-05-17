import { Match } from "@/utils/decorators";
import { IsDateString, IsEmail, IsNotEmpty, IsString, Matches, MinLength } from "class-validator";

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
    @MinLength(8)
    @Matches(/^(?=.*[A-Za-z])(?=.*[^A-Za-z0-9]).*$/, {
        message: 'Password must contain at least one letter and one special character',
    })
    password: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    @Match('password', { message: 'Passwords do not match' })
    confirmPassword: string;

    @IsString()
    @IsNotEmpty()
    firstName: string;

    @IsString()
    @IsNotEmpty()
    lastName: string;

    @IsString()
    @IsNotEmpty()
    @IsDateString()
    dateOfBirth: string;

    @IsString()
    @IsNotEmpty()
    phoneNumber: string;
}