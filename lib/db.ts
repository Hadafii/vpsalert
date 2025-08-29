// lib/db.ts
import mysql from "mysql2/promise";
import { logger } from "@/lib/logs";
// Database configuration interface
interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
  acquireTimeout: number;
  timeout: number;
  ssl?: {
    rejectUnauthorized: boolean;
  };
}

// Create connection pool
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
    acquireTimeout: 60000,
    timeout: 60000,
    ...(process.env.NODE_ENV === "production" && {
      ssl: { rejectUnauthorized: false },
    }),
  };

  pool = mysql.createPool(config);

  // Handle pool events through the underlying pool
  if (pool.pool) {
    pool.pool.on("connection", (connection: any) => {
      logger.log(
        "Database connection established as id " + connection.threadId
      );
    });

    pool.pool.on("error", (err: any) => {
      logger.error("Database pool error:", err);
      if (err.code === "PROTOCOL_CONNECTION_LOST") {
        pool = null; // Reset pool to recreate on next request
      }
    });
  }

  return pool;
};

// Get database connection
export const getConnection = (): mysql.Pool => {
  if (!pool) {
    pool = createPool();
  }
  return pool;
};

// Execute query with automatic connection management
export const query = async <T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> => {
  const connection = getConnection();

  try {
    const [rows] = await connection.execute(sql, params);
    return rows as T[];
  } catch (error) {
    logger.error("Database query error:", { sql, params, error });
    throw new Error(`Database query failed: ${(error as Error).message}`);
  }
};

// Execute single row query
export const queryRow = async <T = any>(
  sql: string,
  params: any[] = []
): Promise<T | null> => {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
};

// Execute insert and return insertId
export const insert = async (
  sql: string,
  params: any[] = []
): Promise<{ insertId: number; affectedRows: number }> => {
  const connection = getConnection();

  try {
    const [result] = (await connection.execute(sql, params)) as [
      mysql.ResultSetHeader,
      any,
    ];
    return {
      insertId: result.insertId,
      affectedRows: result.affectedRows,
    };
  } catch (error) {
    logger.error("Database insert error:", { sql, params, error });
    throw new Error(`Database insert failed: ${(error as Error).message}`);
  }
};

// Execute update/delete and return affected rows
export const update = async (
  sql: string,
  params: any[] = []
): Promise<number> => {
  const connection = getConnection();

  try {
    const [result] = (await connection.execute(sql, params)) as [
      mysql.ResultSetHeader,
      any,
    ];
    return result.affectedRows;
  } catch (error) {
    logger.error("Database update error:", { sql, params, error });
    throw new Error(`Database update failed: ${(error as Error).message}`);
  }
};

// Transaction helper
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

// Health check
export const healthCheck = async (): Promise<boolean> => {
  try {
    await query("SELECT 1");
    return true;
  } catch {
    return false;
  }
};

// Graceful shutdown
export const closePool = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    logger.log("Database pool closed");
  }
};

// Types for common database operations
export interface DatabaseRow {
  [key: string]: any;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
}
