import { Injectable, Logger } from "@nestjs/common";
import { CacheHealthService } from "./cache-health.service";
import { CachedUser } from "../types/cache.types";

@Injectable()
export class UserCacheService {
  private readonly logger = new Logger(UserCacheService.name);
  private readonly TTL = 15 * 60 * 1000; // 15 minutes

  constructor(private readonly cacheService: CacheHealthService) { }

  /**
   * Get user from cache by email
   */
  async getUserByEmail(email: string): Promise<CachedUser | null> {
    try {
      const user = await this.cacheService
        .getValidatedCache()
        .get<CachedUser>(`user:email:${email}`);
      return user ?? null;
    } catch (error) {
      this.logger.error(`Failed to get user by email: ${error.message}`);
      return null; // Graceful degradation
    }
  }

  /**
   * Get user from cache by ID
   */
  async getUserById(userId: string): Promise<CachedUser | null> {
    try {
      const user = await this.cacheService
        .getValidatedCache()
        .get<CachedUser>(`user:id:${userId}`);
      return user ?? null;
    } catch (error) {
      this.logger.error(`Failed to get user by ID: ${error.message}`);
      return null;
    }
  }

  /**
   * Cache user with both email and ID keys
   */
  async cacheUser(user: CachedUser, ttl?: number): Promise<void> {
    try {
      const cacheTTL = ttl ?? this.TTL;
      await Promise.all([
        this.cacheService
          .getValidatedCache()
          .set(`user:email:${user.email}`, user, cacheTTL),
        this.cacheService
          .getValidatedCache()
          .set(`user:id:${user.id}`, user, cacheTTL),
      ]);
      this.logger.log(`User cached: ${user.email} (ID: ${user.id})`);
    } catch (error) {
      this.logger.error(`Failed to cache user: ${error.message}`);
      throw error; // Re-throw for caller to handle
    }
  }

  /**
   * Clear user cache by user ID
   */
  async clearUserById(userId: string): Promise<void> {
    try {
      // First, get the user to obtain the email for deletion
      const user = await this.getUserById(userId);

      if (user) {
        await Promise.all([
          this.cacheService.getValidatedCache().del(`user:email:${user.email}`),
          this.cacheService.getValidatedCache().del(`user:id:${userId}`),
        ]);
        this.logger.log(`Cache cleared for user: ${user.email} (ID: ${userId})`);
      } else {
        // If user not in cache, just try to delete by ID
        await this.cacheService.getValidatedCache().del(`user:id:${userId}`);
        this.logger.log(`Cache cleared for user ID: ${userId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to clear user cache: ${error.message}`);
    }
  }

  /**
   * Clear user cache by email
   */
  async clearUserByEmail(email: string): Promise<void> {
    try {
      const user = await this.getUserByEmail(email);

      if (user) {
        await Promise.all([
          this.cacheService.getValidatedCache().del(`user:email:${email}`),
          this.cacheService.getValidatedCache().del(`user:id:${user.id}`),
        ]);
        this.logger.log(`Cache cleared for user: ${email} (ID: ${user.id})`);
      } else {
        // If user not in cache, just try to delete by email
        await this.cacheService.getValidatedCache().del(`user:email:${email}`);
        this.logger.log(`Cache cleared for email: ${email}`);
      }
    } catch (error) {
      this.logger.error(`Failed to clear user cache by email: ${error.message}`);
    }
  }

  /**
   * Invalidate all sessions for a user by user ID
   */
  async invalidateAllSessions(userId: string): Promise<void> {
    try {
      const deletionPromises: Promise<boolean>[] = [];

      // Delete main session cache
      deletionPromises.push(this.cacheService.getValidatedCache().del(`session:${userId}`));

      // Check if the cache store supports pattern deletion
      const store = (this.cacheService.getValidatedCache() as any).store;
      if (store?.keys) {
        const pattern = `session:${userId}:*`;
        const keys = await store.keys(pattern);

        if (keys.length > 0) {
          keys.forEach((key: string) => {
            deletionPromises.push(this.cacheService.getValidatedCache().del(key));
          });
        }
      }

      await Promise.all(deletionPromises);
      this.logger.log(`All sessions invalidated for user ID: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to invalidate sessions: ${error.message}`);
    }
  }

  /**
   * Refresh user data in cache from database
   * Note: This requires a userService or repository to fetch fresh data
   */
  async refreshUserCache(
    userId: string,
    fetchUserFn: (userId: string) => Promise<CachedUser>
  ): Promise<void> {
    try {
      // Clear existing cache
      await this.clearUserById(userId);

      // Fetch fresh user data
      const freshUser = await fetchUserFn(userId);

      // Cache the fresh data
      await this.cacheUser(freshUser);

      this.logger.log(`User cache refreshed for user ID: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to refresh user cache: ${error.message}`);
      throw error;
    }
  }

  /**
   * Invalidate user and all associated sessions
   */
  async invalidateUser(userId: string): Promise<void> {
    try {
      await Promise.all([
        this.clearUserById(userId),
        this.invalidateAllSessions(userId),
      ]);
      this.logger.log(`User and sessions invalidated for user ID: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to invalidate user: ${error.message}`);
    }
  }

  /**
   * Get session data by user ID and optional session ID
   */
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

  /**
   * Set session data by user ID and optional session ID
   */
  async setSession(
    userId: string,
    sessionData: any,
    sessionId?: string,
    ttl?: number
  ): Promise<void> {
    const key = sessionId
      ? `session:${userId}:${sessionId}`
      : `session:${userId}`;
    try {
      await this.cacheService
        .getValidatedCache()
        .set(key, sessionData, ttl ?? this.TTL);
      this.logger.log(`Session set for user ID: ${userId}${sessionId ? ` (Session: ${sessionId})` : ''}`);
    } catch (error) {
      this.logger.error(`Failed to set session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clear a specific session by user ID and session ID
   */
  async clearSession(userId: string, sessionId?: string): Promise<void> {
    const key = sessionId
      ? `session:${userId}:${sessionId}`
      : `session:${userId}`;
    try {
      await this.cacheService.getValidatedCache().del(key);
      this.logger.log(`Session cleared for user ID: ${userId}${sessionId ? ` (Session: ${sessionId})` : ''}`);
    } catch (error) {
      this.logger.error(`Failed to clear session: ${error.message}`);
    }
  }

  /**
   * Check if user exists in cache
   */
  async userExistsInCache(userId: string): Promise<boolean> {
    try {
      const user = await this.getUserById(userId);
      return user !== null;
    } catch (error) {
      this.logger.error(`Failed to check user existence: ${error.message}`);
      return false;
    }
  }

  /**
   * Update specific user fields in cache
   */
  async updateUserInCache(
    userId: string,
    updates: Partial<CachedUser>
  ): Promise<void> {
    try {
      const existingUser = await this.getUserById(userId);

      if (!existingUser) {
        this.logger.warn(`Cannot update non-existent user in cache: ${userId}`);
        return;
      }

      const updatedUser: CachedUser = {
        ...existingUser,
        ...updates,
        id: existingUser.id, // Ensure ID cannot be changed
      };

      await this.cacheUser(updatedUser);
      this.logger.log(`User updated in cache: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to update user in cache: ${error.message}`);
      throw error;
    }
  }
}