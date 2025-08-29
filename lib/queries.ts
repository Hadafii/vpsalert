// lib/queries.ts
import { query, queryRow, insert, update, transaction } from "./db";
import logger from "./logs";

// ====================================
// TYPE DEFINITIONS
// ====================================

export type VPSStatus = "available" | "out-of-stock";
export type StatusChange = "became_available" | "became_out_of_stock";

export interface DatacenterStatus {
  id: number;
  model: number;
  datacenter: string;
  status: VPSStatus;
  last_checked: string;
  last_changed: string | null;
}

export interface User {
  id: number;
  email: string;
  email_verified: boolean;
  verification_token: string | null;
  unsubscribe_token: string;
  created_at: string;
}

export interface UserSubscription {
  id: number;
  user_id: number;
  model: number;
  datacenter: string;
  is_active: boolean;
  created_at: string;
}

export interface EmailNotification {
  id: number;
  user_id: number;
  model: number;
  datacenter: string;
  status_change: StatusChange;
  created_at: string;
  sent_at: string | null;
  failed_attempts: number;
}

export interface StatusHistory {
  id: number;
  model: number;
  datacenter: string;
  old_status: VPSStatus | null;
  new_status: VPSStatus;
  changed_at: string;
}

// ====================================
// STATUS QUERIES
// ====================================

// Get all current status for dashboard
export const getAllStatus = async (): Promise<DatacenterStatus[]> => {
  const sql = `
    SELECT 
      id, model, datacenter, status, 
      last_checked, last_changed
    FROM datacenter_status 
    ORDER BY model ASC, datacenter ASC
  `;
  return await query<DatacenterStatus>(sql);
};

// Get status for specific model
export const getStatusByModel = async (
  model: number
): Promise<DatacenterStatus[]> => {
  const sql = `
    SELECT 
      id, model, datacenter, status, 
      last_checked, last_changed
    FROM datacenter_status 
    WHERE model = ?
    ORDER BY datacenter ASC
  `;
  return await query<DatacenterStatus>(sql, [model]);
};

// Get status for specific model and datacenter
export const getStatusByModelAndDatacenter = async (
  model: number,
  datacenter: string
): Promise<DatacenterStatus | null> => {
  const sql = `
    SELECT 
      id, model, datacenter, status, 
      last_checked, last_changed
    FROM datacenter_status 
    WHERE model = ? AND datacenter = ?
  `;
  return await queryRow<DatacenterStatus>(sql, [model, datacenter]);
};

// Update or insert status (upsert)
export const upsertStatus = async (
  model: number,
  datacenter: string,
  status: VPSStatus
): Promise<{ changed: boolean; oldStatus?: VPSStatus }> => {
  return await transaction(async (connection) => {
    // Check current status
    const [currentRows] = (await connection.execute(
      "SELECT status FROM datacenter_status WHERE model = ? AND datacenter = ?",
      [model, datacenter]
    )) as [any[], any];

    const currentStatus = currentRows[0]?.status as VPSStatus | undefined;
    const statusChanged = currentStatus !== status;

    if (currentRows.length === 0) {
      // Insert new record
      await connection.execute(
        `INSERT INTO datacenter_status (model, datacenter, status, last_changed) 
         VALUES (?, ?, ?, NOW())`,
        [model, datacenter, status]
      );
    } else {
      // Update existing record
      const lastChangedUpdate = statusChanged ? ", last_changed = NOW()" : "";
      await connection.execute(
        `UPDATE datacenter_status 
         SET status = ?, last_checked = NOW()${lastChangedUpdate}
         WHERE model = ? AND datacenter = ?`,
        [status, model, datacenter]
      );
    }

    // Record history if status changed
    if (statusChanged) {
      await connection.execute(
        `INSERT INTO status_history (model, datacenter, old_status, new_status)
         VALUES (?, ?, ?, ?)`,
        [model, datacenter, currentStatus || null, status]
      );
    }

    return {
      changed: statusChanged,
      oldStatus: currentStatus,
    };
  });
};

// ====================================
// USER QUERIES
// ====================================

// Get or create user by email
export const getOrCreateUser = async (email: string): Promise<User> => {
  return await transaction(async (connection) => {
    // Check if user exists
    const [existingRows] = (await connection.execute(
      "SELECT * FROM users WHERE email = ?",
      [email]
    )) as [any[], any];

    if (existingRows.length > 0) {
      return existingRows[0] as User;
    }

    // Create new user
    const verificationToken = generateToken();
    const unsubscribeToken = generateToken();

    const [result] = (await connection.execute(
      `INSERT INTO users (email, verification_token, unsubscribe_token)
       VALUES (?, ?, ?)`,
      [email, verificationToken, unsubscribeToken]
    )) as [any, any];

    const [newUserRows] = (await connection.execute(
      "SELECT * FROM users WHERE id = ?",
      [result.insertId]
    )) as [any[], any];

    return newUserRows[0] as User;
  });
};

// Verify user email
export const verifyUser = async (token: string): Promise<User | null> => {
  return await transaction(async (connection) => {
    try {
      // Check if user exists with this token
      const [existingRows] = (await connection.execute(
        "SELECT * FROM users WHERE verification_token = ? AND email_verified = 0",
        [token]
      )) as [any[], any];

      if (existingRows.length === 0) {
        // Token not found or already verified
        return null;
      }

      const user = existingRows[0] as User;

      // Update user as verified
      await connection.execute(
        "UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?",
        [user.id]
      );

      // Return updated user data
      return {
        ...user,
        email_verified: true,
        verification_token: null,
      };
    } catch (error) {
      logger.error("Database error in verifyUser:", error);
      throw error;
    }
  });
};

// Get user by unsubscribe token
export const getUserByUnsubscribeToken = async (
  token: string
): Promise<User | null> => {
  const sql = "SELECT * FROM users WHERE unsubscribe_token = ?";
  return await queryRow<User>(sql, [token]);
};

// ====================================
// SUBSCRIPTION QUERIES
// ====================================

// Get user subscriptions
export const getUserSubscriptions = async (
  userId: number
): Promise<UserSubscription[]> => {
  const sql = `
    SELECT * FROM user_subscriptions 
    WHERE user_id = ? AND is_active = 1
    ORDER BY model ASC, datacenter ASC
  `;
  return await query<UserSubscription>(sql, [userId]);
};

// Create or update subscription
export const upsertSubscription = async (
  userId: number,
  model: number,
  datacenter: string
): Promise<UserSubscription> => {
  return await transaction(async (connection) => {
    // Check if subscription exists
    const [existingRows] = (await connection.execute(
      "SELECT * FROM user_subscriptions WHERE user_id = ? AND model = ? AND datacenter = ?",
      [userId, model, datacenter]
    )) as [any[], any];

    if (existingRows.length > 0) {
      // Reactivate if exists but inactive
      await connection.execute(
        "UPDATE user_subscriptions SET is_active = 1 WHERE id = ?",
        [existingRows[0].id]
      );
      return { ...existingRows[0], is_active: true } as UserSubscription;
    }

    // Create new subscription
    const [result] = (await connection.execute(
      "INSERT INTO user_subscriptions (user_id, model, datacenter) VALUES (?, ?, ?)",
      [userId, model, datacenter]
    )) as [any, any];

    const [newSubRows] = (await connection.execute(
      "SELECT * FROM user_subscriptions WHERE id = ?",
      [result.insertId]
    )) as [any[], any];

    return newSubRows[0] as UserSubscription;
  });
};

// Unsubscribe user from specific model+datacenter
export const unsubscribeFromModel = async (
  userId: number,
  model: number,
  datacenter: string
): Promise<boolean> => {
  const sql = `
    UPDATE user_subscriptions 
    SET is_active = 0 
    WHERE user_id = ? AND model = ? AND datacenter = ?
  `;
  const affectedRows = await update(sql, [userId, model, datacenter]);
  return affectedRows > 0;
};

// Unsubscribe user completely
export const unsubscribeUser = async (userId: number): Promise<boolean> => {
  const sql = "UPDATE user_subscriptions SET is_active = 0 WHERE user_id = ?";
  const affectedRows = await update(sql, [userId]);
  return affectedRows > 0;
};

// Get active subscriptions for status change notifications
export const getActiveSubscriptionsForStatus = async (
  model: number,
  datacenter: string
): Promise<UserSubscription[]> => {
  const sql = `
    SELECT us.*, u.email, u.email_verified
    FROM user_subscriptions us
    JOIN users u ON us.user_id = u.id
    WHERE us.model = ? AND us.datacenter = ? 
      AND us.is_active = 1 AND u.email_verified = 1
  `;
  return await query<
    UserSubscription & { email: string; email_verified: boolean }
  >(sql, [model, datacenter]);
};

// ====================================
// EMAIL NOTIFICATION QUERIES
// ====================================

// Queue email notification
export const queueEmailNotification = async (
  userId: number,
  model: number,
  datacenter: string,
  statusChange: StatusChange
): Promise<void> => {
  // Check if similar notification already exists in last 10 minutes
  const existingNotification = await queryRow(
    `SELECT id FROM email_notifications 
     WHERE user_id = ? AND model = ? AND datacenter = ? 
       AND status_change = ? AND created_at > DATE_SUB(NOW(), INTERVAL 10 MINUTE)
     ORDER BY created_at DESC LIMIT 1`,
    [userId, model, datacenter, statusChange]
  );

  if (!existingNotification) {
    await insert(
      "INSERT INTO email_notifications (user_id, model, datacenter, status_change) VALUES (?, ?, ?, ?)",
      [userId, model, datacenter, statusChange]
    );
  }
};

// Get pending email notifications
export const getPendingEmails = async (
  limit: number = 50
): Promise<
  (EmailNotification & { email: string; unsubscribe_token: string })[]
> => {
  const sql = `
    SELECT en.*, u.email, u.unsubscribe_token
    FROM email_notifications en
    JOIN users u ON en.user_id = u.id
    WHERE en.sent_at IS NULL AND en.failed_attempts < 3
    ORDER BY en.created_at ASC
    LIMIT ?
  `;
  return await query<
    EmailNotification & { email: string; unsubscribe_token: string }
  >(sql, [limit]);
};

// Mark email as sent
export const markEmailAsSent = async (emailId: number): Promise<void> => {
  await update("UPDATE email_notifications SET sent_at = NOW() WHERE id = ?", [
    emailId,
  ]);
};

// Increment failed attempts
export const incrementEmailFailedAttempts = async (
  emailId: number
): Promise<void> => {
  await update(
    "UPDATE email_notifications SET failed_attempts = failed_attempts + 1 WHERE id = ?",
    [emailId]
  );
};

// ====================================
// UTILITY FUNCTIONS
// ====================================

// Generate random token
const generateToken = (): string => {
  return require("crypto").randomBytes(16).toString("hex");
};

// Get VPS models (could be from config or database)
export const getVPSModels = (): number[] => {
  return [1, 2, 3, 4, 5, 6]; // Based on your system, adjust as needed
};

// Get datacenters
export const getDatacenters = (): string[] => {
  return ["GRA", "SBG", "BHS", "WAW", "UK", "DE", "FR", "SGP", "SYD"]; // Adjust based on OVH datacenters you monitor
};

// ====================================
// ANALYTICS QUERIES (Optional)
// ====================================

// Get status history for specific model/datacenter
export const getStatusHistory = async (
  model: number,
  datacenter: string,
  days: number = 7
): Promise<StatusHistory[]> => {
  const sql = `
    SELECT * FROM status_history
    WHERE model = ? AND datacenter = ?
      AND changed_at > DATE_SUB(NOW(), INTERVAL ? DAY)
    ORDER BY changed_at DESC
  `;
  return await query<StatusHistory>(sql, [model, datacenter, days]);
};

// Get availability statistics
export const getAvailabilityStats = async (
  days: number = 7
): Promise<any[]> => {
  const sql = `
    SELECT 
      model, datacenter,
      COUNT(*) as total_changes,
      SUM(CASE WHEN new_status = 'available' THEN 1 ELSE 0 END) as became_available_count,
      SUM(CASE WHEN new_status = 'out-of-stock' THEN 1 ELSE 0 END) as became_unavailable_count
    FROM status_history
    WHERE changed_at > DATE_SUB(NOW(), INTERVAL ? DAY)
    GROUP BY model, datacenter
    ORDER BY model, datacenter
  `;
  return await query(sql, [days]);
};
