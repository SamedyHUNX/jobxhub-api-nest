import { Match } from "@/utils/decorators";
import { IsNotEmpty, IsString, Matches, MinLength } from "class-validator";

export class ResetPasswordDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    @Matches(/^(?=.*[A-Za-z])(?=.*[^A-Za-z0-9]).*$/, {
        message:
            'Password must contain at least one letter and one special character',
    })
    newPassword: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    @Match('newPassword', { message: 'Passwords do not match' })
    confirmPassword: string;
}