import { ConfigService } from "@/common/services/config.service";
import { HashingService } from "@/common/services/hashing.service";
import { TokenService } from "@/common/services/token.service";
import { DrizzleHealthService } from "@/drizzle/services/drizzle-health.service";
import { InngestHealthService } from "@/inngest/services/inngest-health.service";
import { S3HealthService } from "@/s3/services/s3-health.service";
import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, Logger, OnModuleInit } from "@nestjs/common";
import { SignUpDto } from "../dto/auth.dto";
import { UserTable } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import * as Sentry from '@sentry/node';
import type { User } from "@/types";
import { DatabaseUtilsService } from "@/common/services/database-utils.service";
import { capitalizeString } from "@/utils/string.utils";

@Injectable() export class SignUpService {
    private logger = new Logger(SignUpService.name)

    constructor(
        private readonly hashingService: HashingService,
        private readonly s3Service: S3HealthService,
        private readonly configService: ConfigService,
        private readonly inngestService: InngestHealthService,
        private readonly dbService: DrizzleHealthService,
        private readonly tokenService: TokenService,
        private readonly dbUtilService: DatabaseUtilsService
    ) { }

    async signUp(
        data: SignUpDto,
        imageFile: Express.Multer.File,
        acceptLanguage: string,
    ) {
        const {
            username,
            password,
            email,
            firstName,
            lastName,
            dateOfBirth,
            phoneNumber,
        } = data;

        if (!imageFile) {
            throw new BadRequestException('Profile image is required');
        }

        // Check if user exists
        await this.dbUtilService.validateUserDoesNotExist(email, username);

        // Upload profile image
        const { key: imageKey, url: imageUrl } = await this.s3Service.s3().uploadFileAndGetUrl(imageFile, 'users', 'avatars');

        try {
            // Create user in database
            const user: User = await this.createUser({
                username,
                password,
                email,
                firstName,
                lastName,
                dateOfBirth,
                phoneNumber,
                imageUrl,
            });

            // Send verification email
            await this.sendVerificationEmail(user, acceptLanguage, imageKey);

            return true;
        } catch (error) {
            // Cleanup orphaned file
            await this.s3Service.s3().cleanupUploadedImage(imageKey);
            throw error;
        }
    }

    private async createUser(userData: {
        username: string;
        password: string;
        email: string;
        firstName: string;
        lastName: string;
        dateOfBirth: string;
        phoneNumber: string;
        imageUrl: string;
    }) {
        const hashedPassword = await this.hashingService.hash(userData.password);
        const capitalizedFirstName = capitalizeString(userData.firstName);
        const capitalizedLastName = capitalizeString(userData.lastName);

        const {
            token: verificationToken,
            hashedToken: hashedVerificationToken,
            expiresAt: verificationExpires,
        } = await this.tokenService.generateAndHashToken(60 * 24);

        try {
            const [user] = await this.dbService.getDb()
                .insert(UserTable)
                .values({
                    username: userData.username,
                    email: userData.email,
                    firstName: capitalizedFirstName,
                    lastName: capitalizedLastName,
                    dateOfBirth: new Date(userData.dateOfBirth),
                    password: hashedPassword,
                    phoneNumber: userData.phoneNumber,
                    imageUrl: userData.imageUrl,
                    userRole: 'USER',
                    verificationToken: hashedVerificationToken,
                    verificationExpires: verificationExpires,
                })
                .returning();

            // Store the plain token temporarily for email
            (user as any)._verificationToken = verificationToken;

            return user;
        } catch (dbError: any) {
            this.handleDatabaseError(dbError);
        }
    }

    private handleDatabaseError(dbError: any): never {
        if (dbError.code === '23505') {
            if (dbError.constraint?.includes('email')) {
                throw new ConflictException('Email already exists');
            }
            if (dbError.constraint?.includes('username')) {
                throw new ConflictException('Username already taken');
            }
        }
        throw dbError;
    }

    private async sendVerificationEmail(
        user: User,
        acceptLanguage: string,
        imageKey: string,
    ) {
        const frontendUrl = this.configService.publicUrl;
        const locale = acceptLanguage || 'en';

        if (!frontendUrl) {
            throw new InternalServerErrorException('Application configuration error');
        }

        const verificationToken = (user as any)._verificationToken;
        const verificationUrl = `${frontendUrl}/${locale}/verify-email?token=${verificationToken}`;

        try {
            this.logger.log(`Sending Inngest event for user signup: ${user.email} (${user.id})`);

            const eventData = {
                userId: user.id,
                email: user.email,
                name: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                imageUrl: user.imageUrl,
                verificationUrl,
                acceptLanguage: locale,
            };

            await this.inngestService.getInngest().send({
                name: 'jobxhub/user.created',
                data: eventData,
            });

            this.logger.log(`Inngest event sent successfully for user: ${user.email}`);
        } catch (inngestError: any) {
            await this.rollbackUserCreation(user.id, imageKey, inngestError);
        }
    }

    private async rollbackUserCreation(
        userId: string,
        imageKey: string,
        inngestError: any,
    ) {
        // Delete the user
        await this.dbService.getDb().delete(UserTable).where(eq(UserTable.id, userId));

        // Delete the uploaded image
        await this.s3Service.s3().deleteFile(imageKey);

        const errorMessage = inngestError?.message || 'Unknown error';
        const errorStack = inngestError?.stack || 'No stack trace available';

        this.logger.error(
            `Failed to emit user.created event for user: ${userId}`,
            errorStack,
        );

        Sentry.captureException(inngestError, {
            tags: { operation: 'signup_inngest_failed' },
            extra: {
                userId,
                context: 'signup_inngest_failed',
                errorMessage,
                errorStack,
            },
        });

        throw new InternalServerErrorException(
            'Failed to complete signup. Please try again',
        );
    }
}