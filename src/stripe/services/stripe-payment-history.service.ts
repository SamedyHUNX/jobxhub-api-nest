import { PaymentHistoryTable } from "@/drizzle/schema";
import { DrizzleHealthService } from "@/drizzle/services/drizzle-health.service";
import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

@Injectable()
export class StripePaymentHistoryService {
    constructor(private readonly dbService: DrizzleHealthService) { }

    async getPaymentHistory(userId: string) {
        return this.dbService.getDb().query.PaymentHistoryTable.findMany({
            where: eq(PaymentHistoryTable.userId, userId),
            orderBy: (table, { desc }) => [desc(table.createdAt)],
        });
    }
}