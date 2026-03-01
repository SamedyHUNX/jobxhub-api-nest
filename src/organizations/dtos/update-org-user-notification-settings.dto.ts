import { IsBoolean, IsNumber, IsOptional } from "class-validator";

export class UpdateOrgUserNotificationSettingsDto {
    @IsBoolean()
    @IsOptional()
    newApplicationEmailNotifications: boolean;

    @IsNumber()
    @IsOptional()
    minimumRating: number;
}
