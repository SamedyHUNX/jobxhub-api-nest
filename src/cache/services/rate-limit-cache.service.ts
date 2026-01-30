import { Injectable, Logger } from '@nestjs/common';
import { CacheHealthService } from './cache-health.service';

interface AccountLockData {
  lockedUntil: number;
  attempts: number;
}

@Injectable()
export class RateLimitCacheService {
  private readonly logger = new Logger(RateLimitCacheService.name);

  constructor(private readonly cacheHealth: CacheHealthService) {}

  private get cache() {
    return this.cacheHealth.getValidatedCache();
  }

  // ============================================================================
  // IP Rate Limiting
  // ============================================================================

  async getIpAttempts(
    ipAddress: string,
    action: string = 'signin',
  ): Promise<number> {
    const key = `${action}_ip:${ipAddress}`;
    try {
      return (await this.cache.get<number>(key)) || 0;
    } catch (error) {
      this.logger.error(
        `Failed to get ${action} IP attempts: ${error.message}`,
      );
      return 0;
    }
  }

  async incrementIpAttempts(
    ipAddress: string,
    ttlMs: number = 3600 * 1000,
    action: string = 'login',
  ): Promise<number> {
    const key = `${action}_ip:${ipAddress}`;
    const current = await this.getIpAttempts(ipAddress, action);
    const newCount = current + 1;

    try {
      await this.cache.set(key, newCount, ttlMs);
      return newCount;
    } catch (error) {
      this.logger.error(
        `Failed to increment ${action} IP attempts: ${error.message}`,
      );
      return newCount;
    }
  }

  // ============================================================================
  // Email Rate Limiting
  // ============================================================================

  async getEmailAttempts(
    email: string,
    prefix: string = 'login',
  ): Promise<number> {
    try {
      return (await this.cache.get<number>(`${prefix}_email:${email}`)) || 0;
    } catch (error) {
      this.logger.error(`Failed to get email attempts: ${error.message}`);
      return 0;
    }
  }

  async incrementEmailAttempts(
    email: string,
    prefix: string = 'login',
    ttlMs: number = 900 * 1000,
  ): Promise<number> {
    const key = `${prefix}_email:${email}`;
    const current = await this.getEmailAttempts(email, prefix);
    const newCount = current + 1;

    try {
      await this.cache.set(key, newCount, ttlMs);
      return newCount;
    } catch (error) {
      this.logger.error(`Failed to increment email attempts: ${error.message}`);
      return newCount;
    }
  }

  // ============================================================================
  // Account Locking
  // ============================================================================

  async isAccountLocked(email: string): Promise<boolean> {
    const lockData = await this.getAccountLockData(email);

    if (!lockData) {
      return false;
    }

    // Check if lock has expired
    if (Date.now() > lockData.lockedUntil) {
      await this.unlockAccount(email);
      return false;
    }

    return true;
  }

  async getAccountLockData(email: string): Promise<AccountLockData | null> {
    try {
      const accountLockData = await this.cache.get<AccountLockData>(
        `account_lock:${email}`,
      );
      return accountLockData ?? null;
    } catch (error) {
      this.logger.error(`Failed to get account lock data: ${error.message}`);
      return null;
    }
  }

  async lockAccount(
    email: string,
    attempts: number,
    durationMs: number,
  ): Promise<void> {
    const lockData: AccountLockData = {
      lockedUntil: Date.now() + durationMs,
      attempts,
    };

    try {
      await this.cache.set(`account_lock:${email}`, lockData, durationMs);
      this.logger.warn(
        `Account locked: ${email} for ${durationMs / 1000}s after ${attempts} failed attempts`,
      );
    } catch (error) {
      this.logger.error(`Failed to lock account: ${error.message}`);
    }
  }

  async unlockAccount(email: string): Promise<void> {
    try {
      await this.cache.del(`account_lock:${email}`);
      this.logger.log(`Account unlocked: ${email}`);
    } catch (error) {
      this.logger.error(`Failed to unlock account: ${error.message}`);
    }
  }

  // ============================================================================
  // Failed Login Attempts
  // ============================================================================

  async getFailedAttempts(email: string): Promise<number> {
    try {
      return (await this.cache.get<number>(`failed_login:${email}`)) || 0;
    } catch (error) {
      this.logger.error(`Failed to get failed attempts: ${error.message}`);
      return 0;
    }
  }

  async incrementFailedAttempts(
    email: string,
    ttlMs: number = 1800 * 1000,
  ): Promise<number> {
    const key = `failed_login:${email}`;
    const current = await this.getFailedAttempts(email);
    const newCount = current + 1;

    try {
      await this.cache.set(key, newCount, ttlMs);
      return newCount;
    } catch (error) {
      this.logger.error(
        `Failed to increment failed attempts: ${error.message}`,
      );
      return newCount;
    }
  }

  async clearFailedAttempts(email: string): Promise<void> {
    try {
      await Promise.all([
        this.cache.del(`failed_login:${email}`),
        this.cache.del(`account_lock:${email}`),
      ]);
      this.logger.log(`Cleared failed attempts for ${email}`);
    } catch (error) {
      this.logger.error(`Failed to clear failed attempts: ${error.message}`);
    }
  }

  // ============================================================================
  // Password Reset Rate Limiting
  // ============================================================================

  async getPasswordResetIpAttempts(ipAddress: string): Promise<number> {
    try {
      return (await this.cache.get<number>(`pwd_reset_ip:${ipAddress}`)) || 0;
    } catch (error) {
      this.logger.error(
        `Failed to get password reset IP attempts: ${error.message}`,
      );
      return 0;
    }
  }

  async incrementPasswordResetIpAttempts(
    ipAddress: string,
    ttlMs: number = 3600 * 1000,
  ): Promise<number> {
    const key = `pwd_reset_ip:${ipAddress}`;
    const current = await this.getPasswordResetIpAttempts(ipAddress);
    const newCount = current + 1;

    try {
      await this.cache.set(key, newCount, ttlMs);
      return newCount;
    } catch (error) {
      this.logger.error(
        `Failed to increment password reset IP attempts: ${error.message}`,
      );
      return newCount;
    }
  }

  async getPasswordResetEmailAttempts(email: string): Promise<number> {
    return this.getEmailAttempts(email, 'pwd_reset');
  }

  async incrementPasswordResetEmailAttempts(
    email: string,
    ttlMs: number = 3600 * 1000,
  ): Promise<number> {
    return this.incrementEmailAttempts(email, 'pwd_reset', ttlMs);
  }
}
