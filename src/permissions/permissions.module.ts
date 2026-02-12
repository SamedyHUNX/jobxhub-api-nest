import { Module } from "@nestjs/common";
import { AppPermissionService } from "./services/app-permissions.service";
import { StripePermissionsService } from "./services/subscription-permissions.service";
import { CommonModule } from "@/common/common.module";

@Module({
    imports: [CommonModule],
    providers: [AppPermissionService, StripePermissionsService],
    exports: [AppPermissionService, StripePermissionsService],
})
export class PermissionsModule { }