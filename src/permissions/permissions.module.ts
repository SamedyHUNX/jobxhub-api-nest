import { Module } from "@nestjs/common";
import { AppPermissionService } from "./services/app-permissions.service";
import { SubscriptionPermissionsService } from "./services/subscription-permissions.service";
import { CommonModule } from "@/common/common.module";

@Module({
    imports: [CommonModule],
    providers: [AppPermissionService, SubscriptionPermissionsService],
    exports: [AppPermissionService, SubscriptionPermissionsService],
})
export class PermissionsModule { }