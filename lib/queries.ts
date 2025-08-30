import { query, queryRow, insert, update, transaction } from "./db";

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

export interface EmailDigest {
  user_id: number;
  email: string;
  unsubscribe_token: string;
  notifications: Array<{
    id: number;
    model: number;
    datacenter: string;
    status_change: StatusChange;
    created_at: string;
  }>;
}

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

export const upsertStatus = async (
  model: number,
  datacenter: string,
  status: VPSStatus
): Promise<{ changed: boolean; oldStatus?: VPSStatus }> => {
  return await transaction(async (connection) => {
    const [currentRows] = (await connection.execute(
      "SELECT status, last_changed FROM datacenter_status WHERE model = ? AND datacenter = ? FOR UPDATE",
      [model, datacenter]
    )) as [any[], any];

    const currentStatus = currentRows[0]?.status as VPSStatus | undefined;
    const lastChanged = currentRows[0]?.last_changed;
    const statusChanged = currentStatus !== status;

    if (statusChanged && lastChanged) {
      const timeSinceLastChange = Date.now() - new Date(lastChanged).getTime();
      if (timeSinceLastChange < 60000) {
        console.log(
          `Ignoring rapid status change for model ${model} in ${datacenter}: ${currentStatus} → ${status} (${Math.round(timeSinceLastChange / 1000)}s apart)`
        );

        await connection.execute(
          `UPDATE datacenter_status SET last_checked = NOW() WHERE model = ? AND datacenter = ?`,
          [model, datacenter]
        );

        return { changed: false, oldStatus: currentStatus };
      }
    }

    if (currentRows.length === 0) {
      await connection.execute(
        `INSERT INTO datacenter_status (model, datacenter, status, last_changed) 
         VALUES (?, ?, ?, NOW())`,
        [model, datacenter, status]
      );
    } else {
      const lastChangedUpdate = statusChanged ? ", last_changed = NOW()" : "";
      await connection.execute(
        `UPDATE datacenter_status 
         SET status = ?, last_checked = NOW()${lastChangedUpdate}
         WHERE model = ? AND datacenter = ?`,
        [status, model, datacenter]
      );
    }

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

export const getOrCreateUser = async (email: string): Promise<User> => {
  return await transaction(async (connection) => {
    const [existingRows] = (await connection.execute(
      "SELECT * FROM users WHERE email = ?",
      [email]
    )) as [any[], any];

    if (existingRows.length > 0) {
      return existingRows[0] as User;
    }

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

export const verifyUser = async (token: string): Promise<User | null> => {
  return await transaction(async (connection) => {
    try {
      const [existingRows] = (await connection.execute(
        "SELECT * FROM users WHERE verification_token = ? AND email_verified = 0",
        [token]
      )) as [any[], any];

      if (existingRows.length === 0) {
        return null;
      }

      const user = existingRows[0] as User;

      await connection.execute(
        "UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?",
        [user.id]
      );

      return {
        ...user,
        email_verified: true,
        verification_token: null,
      };
    } catch (error) {
      console.error("Database error in verifyUser:", error);
      throw error;
    }
  });
};

export const getUserByUnsubscribeToken = async (
  token: string
): Promise<User | null> => {
  const sql = "SELECT * FROM users WHERE unsubscribe_token = ?";
  return await queryRow<User>(sql, [token]);
};

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

export const upsertSubscription = async (
  userId: number,
  model: number,
  datacenter: string
): Promise<UserSubscription> => {
  return await transaction(async (connection) => {
    const [existingRows] = (await connection.execute(
      "SELECT * FROM user_subscriptions WHERE user_id = ? AND model = ? AND datacenter = ?",
      [userId, model, datacenter]
    )) as [any[], any];

    if (existingRows.length > 0) {
      await connection.execute(
        "UPDATE user_subscriptions SET is_active = 1 WHERE id = ?",
        [existingRows[0].id]
      );
      return { ...existingRows[0], is_active: true } as UserSubscription;
    }

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

export const unsubscribeUser = async (userId: number): Promise<boolean> => {
  const sql = "UPDATE user_subscriptions SET is_active = 0 WHERE user_id = ?";
  const affectedRows = await update(sql, [userId]);
  return affectedRows > 0;
};

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

export const queueEmailNotification = async (
  userId: number,
  model: number,
  datacenter: string,
  statusChange: StatusChange
): Promise<void> => {
  try {
    if (statusChange === "became_out_of_stock") {
      console.log(
        `Skipping out-of-stock notification for user ${userId}, model ${model}, datacenter ${datacenter}`
      );
      return;
    }

    await transaction(async (connection) => {
      const [recentNotifications] = (await connection.execute(
        `SELECT id, status_change, created_at 
         FROM email_notifications 
         WHERE user_id = ? AND model = ? AND datacenter = ? 
           AND created_at > DATE_SUB(NOW(), INTERVAL 10 MINUTE)
         ORDER BY created_at DESC 
         LIMIT 3`,
        [userId, model, datacenter]
      )) as [any[], any];

      for (const notification of recentNotifications) {
        const timeDiff =
          Date.now() - new Date(notification.created_at).getTime();

        if (notification.status_change === statusChange && timeDiff < 600000) {
          console.log(
            `Skipping duplicate notification: ${statusChange} for user ${userId}, model ${model}, datacenter ${datacenter}`
          );
          return;
        }

        if (timeDiff < 300000) {
          console.log(
            `Skipping notification due to recent activity (${Math.round(timeDiff / 1000)}s ago) for user ${userId}, model ${model}, datacenter ${datacenter}`
          );
          return;
        }
      }

      const [pendingNotifications] = (await connection.execute(
        `SELECT id 
         FROM email_notifications 
         WHERE user_id = ? AND model = ? AND datacenter = ? 
           AND sent_at IS NULL AND failed_attempts < 3`,
        [userId, model, datacenter]
      )) as [any[], any];

      if (pendingNotifications.length > 0) {
        console.log(
          `Skipping notification - already pending for user ${userId}, model ${model}, datacenter ${datacenter}`
        );
        return;
      }

      await connection.execute(
        "INSERT INTO email_notifications (user_id, model, datacenter, status_change) VALUES (?, ?, ?, ?)",
        [userId, model, datacenter, statusChange]
      );

      console.log(
        `Queued email notification: ${statusChange} for user ${userId}, model ${model}, datacenter ${datacenter}`
      );
    });
  } catch (error) {
    console.error("Error queueing email notification:", error);
    throw new Error(
      `Failed to queue email notification: ${(error as Error).message}`
    );
  }
};

export const getPendingEmailsGroupedByUser = async (
  limit: number = 50
): Promise<EmailDigest[]> => {
  const safeLimit = Math.max(1, Math.min(Math.floor(Number(limit) || 50), 100));

  try {
    const sql = `
      SELECT 
        en.id,
        en.user_id,
        en.model,
        en.datacenter,
        en.status_change,
        en.created_at,
        u.email,
        u.unsubscribe_token
      FROM email_notifications en
      JOIN users u ON en.user_id = u.id
      WHERE en.sent_at IS NULL 
        AND en.failed_attempts < 3
        AND u.email_verified = 1
        AND en.status_change = 'became_available'
      ORDER BY en.user_id, en.created_at ASC
      LIMIT ${safeLimit}
    `;

    const notifications = await query<
      EmailNotification & { email: string; unsubscribe_token: string }
    >(sql, []);

    const userGroups = new Map<number, EmailDigest>();

    for (const notification of notifications) {
      if (!userGroups.has(notification.user_id)) {
        userGroups.set(notification.user_id, {
          user_id: notification.user_id,
          email: notification.email,
          unsubscribe_token: notification.unsubscribe_token,
          notifications: [],
        });
      }

      userGroups.get(notification.user_id)!.notifications.push({
        id: notification.id,
        model: notification.model,
        datacenter: notification.datacenter,
        status_change: notification.status_change,
        created_at: notification.created_at,
      });
    }

    const result = Array.from(userGroups.values());
    console.log(
      `Successfully grouped ${notifications.length} notifications into ${result.length} user digests`
    );
    return result;
  } catch (error) {
    console.error("getPendingEmailsGroupedByUser failed:", error);
    throw new Error(
      `Failed to get grouped pending emails: ${(error as Error).message}`
    );
  }
};

export const getPendingEmails = async (
  limit: number = 50
): Promise<
  (EmailNotification & { email: string; unsubscribe_token: string })[]
> => {
  const safeLimit = Math.max(1, Math.min(Math.floor(Number(limit) || 50), 100));

  try {
    const sql = `
      SELECT 
        en.id,
        en.user_id,
        en.model,
        en.datacenter,
        en.status_change,
        en.created_at,
        en.sent_at,
        en.failed_attempts,
        u.email,
        u.unsubscribe_token
      FROM email_notifications en
      JOIN users u ON en.user_id = u.id
      WHERE en.sent_at IS NULL 
        AND en.failed_attempts < 3
        AND u.email_verified = 1
        AND en.status_change = 'became_available'
      ORDER BY en.created_at ASC
      LIMIT ${safeLimit}
    `;

    const result = await query<
      EmailNotification & { email: string; unsubscribe_token: string }
    >(sql, []);

    console.log(`Successfully fetched ${result.length} pending emails`);
    return result;
  } catch (error) {
    console.error("getPendingEmails failed:", error);
    throw new Error(
      `Failed to get pending emails: ${(error as Error).message}`
    );
  }
};

export const markMultipleEmailsAsSent = async (
  emailIds: number[]
): Promise<void> => {
  if (!emailIds.length) return;

  try {
    const placeholders = emailIds.map(() => "?").join(",");
    const sql = `UPDATE email_notifications SET sent_at = NOW() WHERE id IN (${placeholders})`;
    const affectedRows = await update(sql, emailIds);
    console.log(
      `Marked ${affectedRows} emails as sent (IDs: ${emailIds.join(", ")})`
    );
  } catch (error) {
    console.error("markMultipleEmailsAsSent error:", error);
    throw new Error(
      `Failed to mark emails as sent: ${(error as Error).message}`
    );
  }
};

export const markEmailAsSent = async (emailId: number): Promise<void> => {
  if (!emailId || emailId <= 0 || !Number.isInteger(emailId)) {
    throw new Error("Invalid email ID");
  }

  try {
    const sql = "UPDATE email_notifications SET sent_at = NOW() WHERE id = ?";
    const affectedRows = await update(sql, [emailId]);
    console.log(
      `Email ${emailId} marked as sent (affected rows: ${affectedRows})`
    );
  } catch (error) {
    console.error("markEmailAsSent error:", error);
    throw new Error(
      `Failed to mark email as sent: ${(error as Error).message}`
    );
  }
};

export const incrementEmailFailedAttempts = async (
  emailId: number
): Promise<void> => {
  if (!emailId || emailId <= 0 || !Number.isInteger(emailId)) {
    throw new Error("Invalid email ID");
  }

  try {
    const sql = `
      UPDATE email_notifications 
      SET failed_attempts = failed_attempts + 1 
      WHERE id = ? AND failed_attempts < 10
    `;
    const affectedRows = await update(sql, [emailId]);
    console.log(
      `Failed attempts incremented for email ${emailId} (affected rows: ${affectedRows})`
    );
  } catch (error) {
    console.error("incrementEmailFailedAttempts error:", error);
    throw new Error(
      `Failed to increment failed attempts: ${(error as Error).message}`
    );
  }
};

export const getEmailNotificationStats = async (): Promise<{
  pending: number;
  sent: number;
  failed: number;
  total: number;
  availableOnly: number;
}> => {
  try {
    const sql = `
      SELECT 
        COUNT(CASE WHEN sent_at IS NULL AND failed_attempts < 3 THEN 1 END) as pending,
        COUNT(CASE WHEN sent_at IS NOT NULL THEN 1 END) as sent,
        COUNT(CASE WHEN failed_attempts >= 3 THEN 1 END) as failed,
        COUNT(*) as total,
        COUNT(CASE WHEN status_change = 'became_available' THEN 1 END) as availableOnly
      FROM email_notifications
      WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `;

    const result = await queryRow<{
      pending: number;
      sent: number;
      failed: number;
      total: number;
      availableOnly: number;
    }>(sql, []);

    return (
      result || { pending: 0, sent: 0, failed: 0, total: 0, availableOnly: 0 }
    );
  } catch (error) {
    console.error("getEmailNotificationStats error:", error);
    return { pending: 0, sent: 0, failed: 0, total: 0, availableOnly: 0 };
  }
};

export const cleanupFailedEmails = async (
  olderThanHours: number = 24
): Promise<number> => {
  const safeHours = Math.max(
    1,
    Math.min(Math.floor(Number(olderThanHours) || 24), 168)
  );

  try {
    const sql = `
      DELETE FROM email_notifications 
      WHERE failed_attempts >= 3 
        AND created_at < DATE_SUB(NOW(), INTERVAL ${safeHours} HOUR)
    `;
    const affectedRows = await update(sql, []);
    console.log(
      `Cleaned up ${affectedRows} failed emails older than ${safeHours} hours`
    );
    return affectedRows;
  } catch (error) {
    console.error("cleanupFailedEmails error:", error);
    return 0;
  }
};

export const testDatabaseQuery = async (): Promise<boolean> => {
  try {
    console.log("Testing database queries...");

    const result1 = await query("SELECT 1 as test", []);
    console.log("Simple SELECT successful:", result1);

    const result2 = await query("SELECT ? as test_param", [123]);
    console.log("Parameterized SELECT successful:", result2);

    const tables = await query("SHOW TABLES", []);
    console.log("Tables found:", tables.length);

    const countResult = await query(
      "SELECT COUNT(*) as count FROM email_notifications",
      []
    );
    console.log("Count query successful:", countResult);

    const joinResult = await query(
      `
      SELECT en.id, u.email
      FROM email_notifications en
      JOIN users u ON en.user_id = u.id
      WHERE en.sent_at IS NULL 
        AND en.failed_attempts < 3
        AND u.email_verified = 1
        AND en.status_change = 'became_available'
    `,
      []
    );
    console.log("JOIN query successful:", joinResult.length, "rows");

    return true;
  } catch (error) {
    console.error("Database test failed:", error);
    return false;
  }
};

const generateToken = (): string => {
  return require("crypto").randomBytes(16).toString("hex");
};

export const getVPSModels = (): number[] => {
  return [1, 2, 3, 4, 5, 6];
};

export const getDatacenters = (): string[] => {
  return ["GRA", "SBG", "BHS", "WAW", "UK", "DE", "FR", "SGP", "SYD"];
};

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
