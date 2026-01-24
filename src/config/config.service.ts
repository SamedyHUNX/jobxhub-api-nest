import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService {
  constructor(private configService: NestConfigService) {}

  // Database
  get dbUrl(): string {
    return this.configService.getOrThrow<string>('DATABASE_URL');
  }
  get dbHost(): string {
    return this.configService.get<string>('DB_HOST') ?? 'localhost';
  }
  get dbPort(): string {
    return this.configService.get<string>('DB_PORT') ?? '5432';
  }
  get dbUser(): string {
    return this.configService.get<string>('DB_USER') ?? 'postgres';
  }
  get dbPassword(): string {
    return this.configService.get<string>('DB_PASSWORD') ?? 'postgres';
  }
  get dbName(): string {
    return this.configService.get<string>('DB_NAME') ?? 'mydb';
  }

  //////////////////////////////////////////////////////////////////////////////////

  // JWT
  get jwtSecret(): string {
    return this.configService.getOrThrow<string>('JWT_SECRET');
  }

  get jwtExpiresIn(): string {
    return this.configService.get<string>('JWT_EXPIRES_IN') ?? '7d';
  }

  //////////////////////////////////////////////////////////////////////////////////

  // Redis
  get redisHost(): string {
    return this.configService.get<string>('REDIS_HOST') ?? 'localhost';
  }
  get redisPort(): number {
    return Number(this.configService.get<number>('REDIS_PORT')) || 6379;
  }
  get redisPw(): string {
    return this.configService.getOrThrow<string>('REDIS_PW');
  }

  //////////////////////////////////////////////////////////////////////////////////

  // R2
  get storageProvider(): string {
    return this.configService.get<string>('STORAGE_PROVIDER') ?? 's3';
  }

  get r2PublicDomain(): string | undefined {
    return this.configService.get<string>('R2_PUBLIC_DOMAIN');
  }

  get r2AccessKeyId(): string | undefined {
    return this.configService.get<string>('R2_ACCESS_KEY_ID');
  }

  get r2SecretAccessKey(): string | undefined {
    return this.configService.get<string>('R2_SECRET_ACCESS_KEY');
  }

  get r2BucketName(): string | undefined {
    return this.configService.get<string>('R2_BUCKET_NAME');
  }

  get r2AccountId(): string | undefined {
    return this.configService.get<string>('R2_ACCOUNT_ID');
  }

  get r2FileSizeLimit(): number {
    return this.configService.getOrThrow<number>('R2_FILE_SIZE_LIMIT');
  }

  //////////////////////////////////////////////////////////////////////////////////

  // AWS S3
  get awsRegion(): string | undefined {
    return this.configService.get<string>('AWS_REGION');
  }

  get awsAccessKeyId(): string | undefined {
    return this.configService.get<string>('AWS_ACCESS_KEY_ID');
  }

  get awsSecretAccessKey(): string | undefined {
    return this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
  }

  get awsS3BucketName(): string | undefined {
    return this.configService.get<string>('S3_BUCKET_NAME');
  }

  get awsS3PublicDomain(): string | undefined {
    return this.configService.get<string>('S3_PUBLIC_DOMAIN');
  }

  //////////////////////////////////////////////////////////////////////////////////

  // Application
  get clientUrl(): string {
    return this.configService.getOrThrow<string>('CLIENT_URL');
  }

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV') ?? 'development';
  }

  get port(): number {
    return Number(this.configService.get<number>('PORT')) || 3000;
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get publicUrl(): string {
    return this.configService.getOrThrow<string>('PUBLIC_URL');
  }

  //////////////////////////////////////////////////////////////////////////////////

  // Inngest
  get inngestEventKey(): string {
    return this.configService.getOrThrow<string>('INNGEST_EVENT_KEY');
  }

  get inngestSigningKey(): string {
    return this.configService.getOrThrow<string>('INNGEST_SIGNING_KEY');
  }

  //////////////////////////////////////////////////////////////////////////////////

  // Email
  get smtpHost(): string {
    return this.configService.getOrThrow<string>('SMTP_HOST');
  }

  get smtpPort(): number {
    return Number(this.configService.getOrThrow<string>('SMTP_PORT')) || 587;
  }

  get smtpUser(): string {
    return this.configService.getOrThrow<string>('SMTP_USER');
  }

  get smtpPass(): string {
    return this.configService.getOrThrow<string>('SMTP_PASS');
  }

  get emailFrom(): string {
    return this.configService.getOrThrow<string>('EMAIL_FROM');
  }

  get<T>(key: string): T | undefined {
    return this.configService.get<T>(key);
  }
}
