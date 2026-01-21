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

  // JWT
  get jwtSecret(): string {
    return this.configService.getOrThrow<string>('JWT_SECRET');
  }

  get jwtExpiresIn(): string {
    return this.configService.get<string>('JWT_EXPIRES_IN') ?? '7d';
  }

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

  // AWS S3
  get awsRegion(): string {
    return this.configService.getOrThrow<string>('AWS_REGION');
  }

  get awsAccessKeyId(): string {
    return this.configService.getOrThrow<string>('AWS_ACCESS_KEY_ID');
  }

  get awsSecretAccessKey(): string {
    return this.configService.getOrThrow<string>('AWS_SECRET_ACCESS_KEY');
  }

  get s3BucketName(): string {
    return this.configService.getOrThrow<string>('S3_BUCKET_NAME');
  }

  // Application
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

  // Inngest
  get inngestEventKey(): string {
    return this.configService.getOrThrow<string>('INNGEST_EVENT_KEY');
  }

  get inngestSigningKey(): string {
    return this.configService.getOrThrow<string>('INNGEST_SIGNING_KEY');
  }

  get<T>(key: string): T | undefined {
    return this.configService.get<T>(key);
  }
}
