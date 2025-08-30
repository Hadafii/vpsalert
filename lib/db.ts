import mysql from "mysql2/promise";
import { logger } from "@/lib/logs";

interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;

  ssl?: {
    rejectUnauthorized: boolean;
  };

  connectTimeout?: number;
  queueLimit?: number;
  enableKeepAlive?: boolean;
  keepAliveInitialDelay?: number;
}

let pool: mysql.Pool | null = null;

const createPool = (): mysql.Pool => {
  if (pool) return pool;

  const config: DatabaseConfig = {
    host: process.env.DB_HOST || "",
    port: parseInt(process.env.DB_PORT || ""),
    user: process.env.DB_USER || "",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "",
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || ""),

    connectTimeout: 60000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    ...(process.env.NODE_ENV === "production" && {
      ssl: { rejectUnauthorized: false },
    }),
  };

  pool = mysql.createPool(config);

  if (pool.pool) {
    pool.pool.on("connection", (connection: any) => {
      logger.log(
        "Database connection established as id " + connection.threadId
      );
    });

    pool.pool.on("error", (err: any) => {
      logger.error("Database pool error:", err);
      if (err.code === "PROTOCOL_CONNECTION_LOST") {
        pool = null;
      }
    });
  }

  return pool;
};

export const getConnection = (): mysql.Pool => {
  if (!pool) {
    pool = createPool();
  }
  return pool;
};

export const query = async <T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> => {
  const connection = getConnection();

  try {
    const sanitizedParams = params.map((param) => {
      if (param === undefined || param === null) {
        return null;
      }

      if (typeof param === "number") {
        return isNaN(param) ? null : param;
      }
      return param;
    });

    logger.log("Executing query:", {
      sql: sql.replace(/\s+/g, " ").trim(),
      paramCount: sanitizedParams.length,
      params: sanitizedParams,
    });

    const [rows] = await connection.execute(sql, sanitizedParams);
    return rows as T[];
  } catch (error) {
    logger.error("Database query error:", {
      sql: sql.replace(/\s+/g, " ").trim(),
      params,
      sanitizedParams: params.map((p) =>
        p === undefined ? "undefined" : p === null ? "null" : typeof p
      ),
      error: {
        message: (error as any).message,
        code: (error as any).code,
        errno: (error as any).errno,
        sqlState: (error as any).sqlState,
      },
    });
    throw new Error(`Database query failed: ${(error as Error).message}`);
  }
};

export const queryRow = async <T = any>(
  sql: string,
  params: any[] = []
): Promise<T | null> => {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
};

export const insert = async (
  sql: string,
  params: any[] = []
): Promise<{ insertId: number; affectedRows: number }> => {
  const connection = getConnection();

  try {
    const sanitizedParams = params.map((param) => {
      if (param === undefined || param === null) {
        return null;
      }
      if (typeof param === "number") {
        return isNaN(param) ? null : param;
      }
      return param;
    });

    const [result] = (await connection.execute(sql, sanitizedParams)) as [
      mysql.ResultSetHeader,
      any,
    ];

    return {
      insertId: result.insertId || 0,
      affectedRows: result.affectedRows || 0,
    };
  } catch (error) {
    logger.error("Database insert error:", { sql, params, error });
    throw new Error(`Database insert failed: ${(error as Error).message}`);
  }
};

export const update = async (
  sql: string,
  params: any[] = []
): Promise<number> => {
  const connection = getConnection();

  try {
    const sanitizedParams = params.map((param) => {
      if (param === undefined || param === null) {
        return null;
      }
      if (typeof param === "number") {
        return isNaN(param) ? null : param;
      }
      return param;
    });

    const [result] = (await connection.execute(sql, sanitizedParams)) as [
      mysql.ResultSetHeader,
      any,
    ];
    return result.affectedRows || 0;
  } catch (error) {
    logger.error("Database update error:", { sql, params, error });
    throw new Error(`Database update failed: ${(error as Error).message}`);
  }
};

export const transaction = async <T>(
  callback: (connection: mysql.PoolConnection) => Promise<T>
): Promise<T> => {
  const pool = getConnection();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    logger.error("Transaction error:", error);
    throw error;
  } finally {
    connection.release();
  }
};

export const healthCheck = async (): Promise<boolean> => {
  try {
    await query("SELECT 1 as test");
    logger.log("Database health check: OK");
    return true;
  } catch (error) {
    logger.error("Database health check failed:", error);
    return false;
  }
};

export const closePool = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    logger.log("Database pool closed");
  }
};

export interface DatabaseRow {
  [key: string]: any;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
}

export const testConnection = async (): Promise<boolean> => {
  try {
    const connection = getConnection();
    const [rows] = await connection.execute(
      "SELECT VERSION() as version, NOW() as now"
    );
    logger.log("Database test connection successful:", rows);
    return true;
  } catch (error) {
    logger.error("Database test connection failed:", error);
    return false;
  }
};
