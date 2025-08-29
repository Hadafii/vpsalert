/**
 * logs.ts - Utility for conditional logging based on environment
 *
 * This utility provides wrapper functions around console methods
 * that only execute in development environment, preventing logs
 * from appearing in production.
 */

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Conditional console logger that only logs in development environment
 */
export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  error: (...args: any[]) => {
    if (isDevelopment) {
      console.error(...args);
    }
  },
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  /**
   * Forces logging even in production (use sparingly for critical errors)
   */
  forceLog: (...args: any[]) => {
    console.log(...args);
  },

  /**
   * Only logs if debug=true in environment variables
   */
  debugLog: (...args: any[]) => {
    if (process.env.DEBUG === "true") {
      console.log("[DEBUG]", ...args);
    }
  },
};

export default logger;
