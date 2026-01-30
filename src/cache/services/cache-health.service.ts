import {
  Injectable,
  Inject,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import * as Sentry from '@sentry/node';

@Injectable()
export class CacheHealthService {
  private readonly logger = new Logger(CacheHealthService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  getValidatedCache(): Cache {
    if (!this.cacheManager) {
      const message = `Redis server is down at ${new Date().toISOString()}`;
      this.logger.error(message);
      Sentry.captureException(new Error(message));
      throw new InternalServerErrorException('Cache service unavailable');
    }
    return this.cacheManager;
  }

  async getRawRedisClient() {
    const cache = this.getValidatedCache();
    const store = (cache as any).store;

    if (store && store.getClient) {
      return store.getClient();
    }

    throw new InternalServerErrorException('Redis client not available');
  }
}
