import { Injectable, Logger } from '@nestjs/common';
import { CacheHealthService } from './cache-health.service';

export interface CachedUser {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  imageUrl?: string;
  userRole: string;
  tokenVersion?: number;
  hasSubscription?: boolean;
  subscription?: any
}

@Injectable()
export class UserCacheService {
  private readonly logger = new Logger(UserCacheService.name);
  private readonly TTL = 15 * 60 * 1000; // 15 minutes

  constructor(private readonly cacheService: CacheHealthService) { }

  // Get user by email
  async getUserByEmail(email: string): Promise<CachedUser | null> {
    try {
      const user = await this.cacheService.getValidatedCache().get<CachedUser>(`user:email:${email}`);
      return user ?? null;
    } catch (error) {
      this.logger.error(`Failed to get user by email: ${error.message}`);
      return null; // Graceful degradation
    }
  }

  // Get user by ID
  async getUserById(userId: string): Promise<CachedUser | null> {
    try {
      const user = await this.cacheService.getValidatedCache().get<CachedUser>(`user:id:${userId}`);
      return user ?? null;
    } catch (error) {
      this.logger.error(`Failed to get user by ID: ${error.message}`);
      return null;
    }
  }

  // Cache user with both email and ID keys
  async setUser(user: CachedUser): Promise<void> {
    try {
      await Promise.all([
        this.cacheService.getValidatedCache().set(`user:email:${user.email}`, user, this.TTL),
        this.cacheService.getValidatedCache().set(`user:id:${user.id}`, user, this.TTL),
      ]);
      this.logger.debug(`User cached: ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to cache user: ${error.message}`);
      // Don't throw - caching failure shouldn't break the flow
    }
  }

  // Clear user cache
  async clearUser(user: { email: string; id: string }): Promise<void> {
    try {
      await Promise.all([
        this.cacheService.getValidatedCache().del(`user:email:${user.email}`),
        this.cacheService.getValidatedCache().del(`user:id:${user.id}`),
      ]);
      this.logger.log(`Cache cleared for user: ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to clear user cache: ${error.message}`);
    }
  }

  // Invalidate user cache (alias for clearUser, for clarity)
  async invalidateUser(email: string, userId: string): Promise<void> {
    await this.clearUser({ email, id: userId });
  }

  // Invalidate all sessions for a user
  async invalidateAllSessions(userId: string): Promise<void> {
    try {
      // Delete main session cache
      await this.cacheService.getValidatedCache().del(`session:${userId}`);

      // Check if the cache store supports pattern deletion
      const store = (this.cacheService.getValidatedCache() as any).store;
      if (store && store.keys) {
        const pattern = `session:${userId}:*`;
        const keys = await store.keys(pattern);

        if (keys.length > 0) {
          await Promise.all(keys.map((key: string) => this.cacheService.getValidatedCache().del(key)));
        }
      }

      this.logger.log(`All sessions invalidated for user ID: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to invalidate sessions: ${error.message}`);
    }
  }

  // Get session
  async getSession(userId: string, sessionId?: string): Promise<any> {
    const key = sessionId
      ? `session:${userId}:${sessionId}`
      : `session:${userId}`;
    try {
      return await this.cacheService.getValidatedCache().get(key);
    } catch (error) {
      this.logger.error(`Failed to get session: ${error.message}`);
      return null;
    }
  }

  // Set session
  async setSession(
    userId: string,
    sessionData: any,
    sessionId?: string,
    ttl?: number,
  ): Promise<void> {
    const key = sessionId
      ? `session:${userId}:${sessionId}`
      : `session:${userId}`;
    try {
      await this.cacheService.getValidatedCache().set(key, sessionData, ttl || this.TTL);
    } catch (error) {
      this.logger.error(`Failed to set session: ${error.message}`);
    }
  }
}
