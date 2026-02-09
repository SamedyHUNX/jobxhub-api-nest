import { ConflictException, Injectable, OnModuleInit } from "@nestjs/common";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/drizzle/schema";
import { DrizzleHealthService } from "@/drizzle/services/drizzle-health.service";
import { eq, or } from "drizzle-orm";
import { S3Service } from "@/s3/services/s3.service";

@Injectable()
export class AuthUtilsService implements OnModuleInit {
    private db: NodePgDatabase<typeof schema>;
    private s3: S3Service;

    constructor(
        private readonly dbHealth: DrizzleHealthService,
        private readonly s3Service: S3Service,
    ) {
        this.s3 = this.s3Service;
    }

    async onModuleInit() {
        this.db = this.dbHealth.getDb();
    }

    async validateUserDoesNotExist(email: string, username: string) {
        const existingUser = await this.db
            .select()
            .from(schema.UserTable)
            .where(or(eq(schema.UserTable.email, email), eq(schema.UserTable.username, username)))
            .limit(1);

        if (existingUser.length > 0) {
            if (existingUser[0].email === email) {
                throw new ConflictException('Email already exists');
            }
            if (existingUser[0].username === username) {
                throw new ConflictException('Username already taken');
            }
        }
    }

    async uploadProfileImage(imageFile: Express.Multer.File) {
        return await this.s3.uploadFileAndGetUrl(imageFile, 'users', 'avatars');
    }
}
