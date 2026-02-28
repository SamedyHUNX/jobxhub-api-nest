import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdateNotificationSettingsDto {
    @IsBoolean()
    @IsOptional()
    newJobEmailNotifications?: boolean;

    @IsString()
    @IsOptional()
    aiPrompt?: string | null;
}