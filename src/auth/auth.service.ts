import { AppService } from '@/app.service';
import { DrizzleService } from '@/drizzle/drizzle.service';
import { S3Service } from '@/s3/s3.service';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Redis } from 'ioredis';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AppService.name);
  constructor(
    private jwtService: JwtService,
    @Inject('REDIS_CLIENT') private readonly redisService: Redis,
    private dbService: DrizzleService,
    private s3Service: S3Service,
  ) {}
}
