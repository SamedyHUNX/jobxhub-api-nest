import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';
import { ConfigService } from '@/config/config.service';

@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigService],
      isGlobal: true,
      useFactory: async (configService: ConfigService) => {
        const host = configService.get<string>('redisHost') || 'localhost';
        const port = configService.get<number>('redisPort') || 6379;
        const password = configService.get<string>('redisPw');
        // Construct Redis URL: redis://[:password@]host:port
        const url = `redis://${password ? `:${password}@` : ''}${host}:${port}`;

        return {
          store: new Keyv({
            store: new KeyvRedis(url),
            ttl: 60 * 1000, // 60 seconds default TTL
          }),
        };
      },
    }),
  ],
})
export class RedisModule {}
