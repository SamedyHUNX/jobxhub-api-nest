import { Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';
import { ConfigService } from '@/config/config.service';
import { AppConfigModule } from '@/config/config.module';
import { UserCacheService } from './services/user-cache.service';
import { RateLimitCacheService } from './services/rate-limit-cache.service';
import { CacheHealthService } from './services/cache-health.service';

@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [AppConfigModule],
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
  providers: [UserCacheService, RateLimitCacheService, CacheHealthService],
  exports: [UserCacheService, RateLimitCacheService, CacheHealthService],
})
export class CacheModule {}
