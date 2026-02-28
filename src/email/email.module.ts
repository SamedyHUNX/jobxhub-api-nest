import { Module } from "@nestjs/common";
import { EmailService } from "./services/email.service";

@Module({
    imports: [],
    controllers: [],
    providers: [EmailService],
    exports: [EmailService],
})
export class EmailModule { }