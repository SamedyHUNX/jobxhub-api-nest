import { ConflictException, Injectable } from "@nestjs/common";
import { DrizzleHealthService } from "@/drizzle/services/drizzle-health.service";
import { eq, or } from "drizzle-orm";
import { S3Service } from "@/s3/services/s3.service";
import { UserTable } from "@/drizzle/schema";

@Injectable()
export class AuthUtilsService {
    constructor(
        private readonly dbService: DrizzleHealthService,
        private readonly s3Service: S3Service,
    ) {
    }
    async validateUserDoesNotExist(email: string, username: string) {
        const existingUser = await this.dbService.getDb()
            .select()
            .from(UserTable)
            .where(or(eq(UserTable.email, email), eq(UserTable.username, username)))
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
        return await this.s3Service.uploadFileAndGetUrl(imageFile, 'users', 'avatars');
    }

    getTimestamp() {
        return new Date().toISOString();
    }
}
