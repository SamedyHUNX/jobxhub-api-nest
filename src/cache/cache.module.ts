import { Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';
import { ConfigService } from '@/common/services/config.service';
import { UserCacheService } from './services/user-cache.service';
import { RateLimitCacheService } from './services/rate-limit-cache.service';
import { CacheHealthService } from './services/cache-health.service';
import { CommonModule } from '@/common/common.module';
import { TokenService } from '../common/services/token.service';

@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [CommonModule],
      inject: [ConfigService],
      isGlobal: true,
      useFactory: async (configService: ConfigService) => {
        const host = configService.redisHost || 'localhost';
        const port = configService.redisPort || 6379;
        const password = configService.redisPw;
        const url = `redis://${password ? `:${encodeURIComponent(password)}@` : ''}${host}:${port}`;

        return {
          store: new Keyv({
            store: new KeyvRedis(url),
            ttl: 60 * 1000, // 60 seconds default TTL
          }),
        };
      },
    }),
  ],
  providers: [UserCacheService, RateLimitCacheService, CacheHealthService, TokenService],
  exports: [UserCacheService, RateLimitCacheService, CacheHealthService, TokenService],
})
export class CacheModule { }
