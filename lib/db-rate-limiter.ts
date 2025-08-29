// lib/db-rate-limiter.ts
import { query, insert } from "./db";
import { logger } from "@/lib/logs";

export const checkRateLimit = async (
  identifier: string,
  windowMinutes: number = 5,
  maxRequests: number = 10
): Promise<boolean> => {
  try {
    // Clean old entries first - run every time for 5-second polling accuracy
    await query(
      `
      DELETE FROM rate_limits 
      WHERE created_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)
    `,
      [windowMinutes]
    );

    // Count current requests in the window
    const result = await query<{ count: number }>(
      `
      SELECT COUNT(*) as count 
      FROM rate_limits 
      WHERE identifier = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)
    `,
      [identifier, windowMinutes]
    );

    const currentCount = result[0]?.count || 0;

    if (currentCount >= maxRequests) {
      logger.warn(
        `Rate limit exceeded for ${identifier}: ${currentCount}/${maxRequests} in ${windowMinutes}min window`
      );
      return false;
    }

    // Record this request
    await insert("INSERT INTO rate_limits (identifier) VALUES (?)", [
      identifier,
    ]);

    return true;
  } catch (error) {
    logger.error("Rate limit check failed:", error);
    // Fail open - allow the request if database is down
    return true;
  }
};

// Get rate limit status for monitoring
export const getRateLimitStatus = async (
  identifier: string,
  windowMinutes: number = 5
): Promise<{
  current: number;
  limit: number;
  windowMinutes: number;
  resetTime: Date;
}> => {
  try {
    const result = await query<{ count: number }>(
      `
      SELECT COUNT(*) as count 
      FROM rate_limits 
      WHERE identifier = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)
    `,
      [identifier, windowMinutes]
    );

    const current = result[0]?.count || 0;
    const resetTime = new Date(Date.now() + windowMinutes * 60 * 1000);

    return {
      current,
      limit: 10, // Default limit, can be configurable
      windowMinutes,
      resetTime,
    };
  } catch (error) {
    logger.error("Failed to get rate limit status:", error);
    return {
      current: 0,
      limit: 10,
      windowMinutes,
      resetTime: new Date(),
    };
  }
};

// Cleanup old rate limit entries (for maintenance)
export const cleanupRateLimits = async (
  olderThanHours: number = 24
): Promise<number> => {
  try {
    const result = await query(
      `
      DELETE FROM rate_limits 
      WHERE created_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
    `,
      [olderThanHours]
    );

    return (result as any).affectedRows || 0;
  } catch (error) {
    logger.error("Failed to cleanup rate limits:", error);
    return 0;
  }
};
