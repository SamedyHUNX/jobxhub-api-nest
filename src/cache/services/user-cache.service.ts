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
      // Get the user ID from the email mapping
      const userId = await this.cacheService
        .getValidatedCache()
        .get<string>(`user:email-to-id:${email}`);

      if (!userId) return null;

      // Fetch the actual user data by ID
      return this.getUserById(userId);
    } catch (error) {
      this.logger.error(`Failed to get user by email: ${error.message}`);
      return null;
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
   * Cache user with ID as source of truth and email mapping
   */
  async cacheUser(user: CachedUser, ttl?: number): Promise<void> {
    try {
      const cacheTTL = ttl ?? this.TTL;
      await Promise.all([
        // Small mapping entry: email -> userId
        this.cacheService
          .getValidatedCache()
          .set(`user:email-to-id:${user.email}`, user.id, cacheTTL),
        // Full user object (single source of truth)
        this.cacheService
          .getValidatedCache()
          .set(`user:id:${user.id}`, user, cacheTTL),
      ]);
      this.logger.log(`User cached: ${user.email} (ID: ${user.id})`);
    } catch (error) {
      this.logger.error(`Failed to cache user: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clear user cache by user ID
   */
  async clearUserById(userId: string): Promise<void> {
    try {
      // First, get the user to obtain the email for mapping deletion
      const user = await this.getUserById(userId);

      if (user) {
        await Promise.all([
          this.cacheService.getValidatedCache().del(`user:email-to-id:${user.email}`),
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
      // Get userId from the mapping
      const userId = await this.cacheService
        .getValidatedCache()
        .get<string>(`user:email-to-id:${email}`);

      if (userId) {
        await Promise.all([
          this.cacheService.getValidatedCache().del(`user:email-to-id:${email}`),
          this.cacheService.getValidatedCache().del(`user:id:${userId}`),
        ]);
        this.logger.log(`Cache cleared for user: ${email} (ID: ${userId})`);
      } else {
        // If mapping not in cache, just try to delete the email mapping
        await this.cacheService.getValidatedCache().del(`user:email-to-id:${email}`);
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
   * Invalidate user and all associated sessions (nuclear option)
   * Use this for: password changes, account compromises, permission revocations
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
   * Invalidate user by email and all associated sessions
   */
  async invalidateUserByEmail(email: string): Promise<void> {
    try {
      // Get userId from mapping first
      const userId = await this.cacheService
        .getValidatedCache()
        .get<string>(`user:email-to-id:${email}`);

      if (userId) {
        await this.invalidateUser(userId);
      } else {
        // Just clear the email mapping if no userId found
        await this.cacheService.getValidatedCache().del(`user:email-to-id:${email}`);
        this.logger.log(`Email mapping cleared: ${email}`);
      }
    } catch (error) {
      this.logger.error(`Failed to invalidate user by email: ${error.message}`);
    }
  }

  /**
   * Refresh user data in cache from database
   * Use this for: profile updates where you want to update cache without killing sessions
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
   * Update user email in cache (handles email change scenario)
   * IMPORTANT: Use this when user changes their email
   */
  async updateUserEmail(userId: string, oldEmail: string, newEmail: string): Promise<void> {
    try {
      // Get the current user data
      const user = await this.getUserById(userId);

      if (!user) {
        this.logger.warn(`Cannot update email for non-existent user: ${userId}`);
        return;
      }

      // Delete old email mapping
      await this.cacheService.getValidatedCache().del(`user:email-to-id:${oldEmail}`);

      // Update user object with new email
      const updatedUser: CachedUser = {
        ...user,
        email: newEmail,
      };

      // Cache with new email mapping
      await this.cacheUser(updatedUser);

      this.logger.log(`User email updated in cache: ${userId} (${oldEmail} -> ${newEmail})`);
    } catch (error) {
      this.logger.error(`Failed to update user email in cache: ${error.message}`);
      throw error;
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
   * NOTE: If updating email, use updateUserEmail() instead
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

      // Prevent email updates through this method
      if (updates.email && updates.email !== existingUser.email) {
        throw new Error('Use updateUserEmail() to change user email');
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