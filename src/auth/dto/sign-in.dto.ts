import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from "class-validator";

export class SignInDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    @Matches(/^(?=.*[A-Za-z])(?=.*[^A-Za-z0-9]).*$/, {
        message:
            'Password must contain at least one letter and one special character',
    })
    password: string;
}