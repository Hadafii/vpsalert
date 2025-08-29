// lib/security.ts
import { z } from "zod";
import DOMPurify from "isomorphic-dompurify";
import validator from "validator";
import { NextRequest } from "next/server";
import crypto from "crypto";

// ====================================
// INPUT VALIDATION SCHEMAS
// ====================================

export const EmailSchema = z
  .string()
  .min(1, "Email is required")
  .max(320, "Email is too long")
  .email("Invalid email format")
  .refine((email) => validator.isEmail(email), "Invalid email format");

export const VPSModelSchema = z
  .number()
  .int("Model must be an integer")
  .min(1, "Invalid VPS model")
  .max(6, "Invalid VPS model");

export const DatacenterSchema = z
  .string()
  .min(2, "Datacenter code too short")
  .max(5, "Datacenter code too long")
  .regex(/^[A-Z]{2,5}$/, "Invalid datacenter format")
  .refine(
    (dc) =>
      ["GRA", "SBG", "BHS", "WAW", "UK", "DE", "FR", "SGP", "SYD"].includes(dc),
    "Invalid datacenter"
  );

export const TokenSchema = z
  .string()
  .length(32, "Token must be 32 characters")
  .regex(/^[a-f0-9]{32}$/, "Invalid token format");

// ====================================
// REQUEST SANITIZATION
// ====================================

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [],
  });
}

/**
 * Sanitize and validate email address
 */
export function sanitizeEmail(email: string): string {
  // Remove whitespace and convert to lowercase
  const cleaned = validator.normalizeEmail(email.trim().toLowerCase()) || "";

  // Additional sanitization
  const sanitized = sanitizeHtml(cleaned);

  // Validate with our schema
  EmailSchema.parse(sanitized);

  return sanitized;
}

/**
 * Sanitize string input (remove HTML, limit length)
 */
export function sanitizeString(
  input: string,
  maxLength: number = 1000
): string {
  // Remove HTML and trim
  const sanitized = sanitizeHtml(input.trim());

  // Limit length
  if (sanitized.length > maxLength) {
    throw new Error(`Input too long (max ${maxLength} characters)`);
  }

  return sanitized;
}

/**
 * Validate and sanitize VPS model
 */
export function sanitizeVPSModel(model: any): number {
  // Convert to number if it's a string
  const numModel = typeof model === "string" ? parseInt(model, 10) : model;

  // Validate
  return VPSModelSchema.parse(numModel);
}

/**
 * Validate and sanitize datacenter code
 */
export function sanitizeDatacenter(datacenter: any): string {
  // Convert to string and uppercase
  const strDatacenter = String(datacenter).toUpperCase().trim();

  // Sanitize HTML
  const sanitized = sanitizeHtml(strDatacenter);

  // Validate
  return DatacenterSchema.parse(sanitized);
}

/**
 * Validate and sanitize token
 */
export const sanitizeToken = (token: string): string => {
  // Clean and validate verification token
  const cleaned = token.trim().toLowerCase();

  // Must be exactly 32 character hex string
  if (!/^[a-f0-9]{32}$/.test(cleaned)) {
    throw new Error("Invalid token format");
  }

  return cleaned;
};

// ====================================
// SQL INJECTION PREVENTION
// ====================================

/**
 * Escape SQL string values (additional layer of protection)
 * Note: We primarily use parameterized queries, but this adds extra safety
 */
export function escapeSQLString(input: string): string {
  // Replace dangerous characters
  return input
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\x1a/g, "\\Z");
}

/**
 * Validate SQL query parameters to prevent injection
 */
export function validateSQLParams(params: any[]): any[] {
  return params.map((param) => {
    if (typeof param === "string") {
      // Sanitize string parameters
      const sanitized = sanitizeString(param, 1000);
      // Additional SQL character validation
      if (
        sanitized.includes("--") ||
        sanitized.includes("/*") ||
        sanitized.includes("*/")
      ) {
        throw new Error("Invalid characters in parameter");
      }
      return sanitized;
    }

    if (typeof param === "number") {
      // Validate numbers
      if (
        !Number.isFinite(param) ||
        param < -2147483648 ||
        param > 2147483647
      ) {
        throw new Error("Invalid number parameter");
      }
      return param;
    }

    if (param === null || param === undefined) {
      return param;
    }

    // For other types, convert to string and sanitize
    return sanitizeString(String(param), 1000);
  });
}

// ====================================
// RATE LIMITING
// ====================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked?: boolean;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    private windowMs: number = 300000,
    private maxRequests: number = 10
  ) {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000);
  }

  private cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.store.entries());

    for (const [key, entry] of entries) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  public isAllowed(identifier: string): boolean {
    const now = Date.now();
    const entry = this.store.get(identifier);

    if (!entry || now > entry.resetTime) {
      // New window
      this.store.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      // Rate limit exceeded
      entry.blocked = true;
      return false;
    }

    // Increment counter
    entry.count++;
    return true;
  }

  public getRemainingRequests(identifier: string): number {
    const entry = this.store.get(identifier);
    if (!entry) return this.maxRequests;
    return Math.max(0, this.maxRequests - entry.count);
  }

  public getResetTime(identifier: string): number {
    const entry = this.store.get(identifier);
    return entry ? entry.resetTime : Date.now();
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Global rate limiters
export const subscriptionRateLimiter = new RateLimiter(300000, 10); // 10 requests per 5 minutes
export const emailRateLimiter = new RateLimiter(3600000, 5); // 5 emails per hour
export const generalRateLimiter = new RateLimiter(60000, 100); // 100 requests per minute

// ====================================
// REQUEST SECURITY
// ====================================

/**
 * Extract real IP address from request headers
 */
export function getClientIP(request: NextRequest): string {
  // Try various headers in order of preference
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-client-ip") ||
    "unknown"
  );
}

/**
 * Validate request origin and prevent CSRF
 */
export function validateOrigin(
  request: NextRequest,
  allowedOrigins: string[]
): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (!origin && !referer) {
    // Allow requests without origin/referer for API clients
    return true;
  }

  const requestOrigin = origin || (referer ? new URL(referer).origin : "");

  return allowedOrigins.some(
    (allowed) =>
      requestOrigin === allowed ||
      requestOrigin.endsWith("." + allowed.replace(/^https?:\/\//, ""))
  );
}

/**
 * Validate cron request authenticity
 */
export function validateCronRequest(
  request: NextRequest,
  secret: string
): boolean {
  const headerSecret = request.headers.get("X-Cron-Secret");
  const paramSecret = request.nextUrl.searchParams.get("secret");

  const providedSecret = headerSecret || paramSecret;

  if (!providedSecret || !secret) {
    return false;
  }

  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    new Uint8Array(Buffer.from(providedSecret)),
    new Uint8Array(Buffer.from(secret))
  );
}

/**
 * Generate secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length / 2).toString("hex");
}

/**
 * Hash sensitive data (one-way)
 */
export function hashData(data: string, salt?: string): string {
  const actualSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.createHmac("sha256", actualSalt);
  hash.update(data);
  return hash.digest("hex");
}

// ====================================
// CONTENT SECURITY
// ====================================

/**
 * Validate file upload (future use)
 */
export function validateFileUpload(
  filename: string,
  mimetype: string,
  size: number,
  maxSize: number = 1024 * 1024 // 1MB
): boolean {
  // Validate file size
  if (size > maxSize) {
    throw new Error(`File too large (max ${maxSize} bytes)`);
  }

  // Validate filename
  const sanitizedName = sanitizeString(filename, 255);
  if (
    sanitizedName.includes("..") ||
    sanitizedName.includes("/") ||
    sanitizedName.includes("\\")
  ) {
    throw new Error("Invalid filename");
  }

  // Validate mimetype (whitelist)
  const allowedTypes = ["text/plain", "application/json", "text/csv"];
  if (!allowedTypes.includes(mimetype)) {
    throw new Error("File type not allowed");
  }

  return true;
}

// ====================================
// SECURITY HEADERS
// ====================================

export function getSecurityHeaders(): Record<string, string> {
  return {
    // Prevent XSS attacks
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",

    // HTTPS enforcement
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",

    // Content Security Policy
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "font-src 'self' https:",
      "object-src 'none'",
      "media-src 'self'",
      "frame-src 'none'",
    ].join("; "),

    // Referrer Policy
    "Referrer-Policy": "strict-origin-when-cross-origin",

    // Permissions Policy
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
}

// ====================================
// ERROR SANITIZATION
// ====================================

/**
 * Sanitize error messages for public consumption
 */
export function sanitizeError(
  error: any,
  isProduction: boolean = true
): string {
  if (!isProduction) {
    return String(error.message || error);
  }

  // In production, return generic messages for security
  const genericMessages: Record<string, string> = {
    ENOTFOUND: "Service temporarily unavailable",
    ECONNREFUSED: "Service temporarily unavailable",
    ETIMEDOUT: "Request timeout",
    ValidationError: "Invalid request data",
    DatabaseError: "Database operation failed",
    EmailError: "Email service unavailable",
  };

  const errorType = error.name || error.code || "UnknownError";
  return genericMessages[errorType] || "An error occurred. Please try again.";
}

// ====================================
// MIDDLEWARE HELPER
// ====================================

export function createSecurityMiddleware(options: {
  rateLimiter?: RateLimiter;
  allowedOrigins?: string[];
  requireCronSecret?: boolean;
}) {
  return async (
    request: NextRequest
  ): Promise<{
    allowed: boolean;
    error?: string;
    headers?: Record<string, string>;
  }> => {
    const clientIP = getClientIP(request);

    // Rate limiting
    if (options.rateLimiter && !options.rateLimiter.isAllowed(clientIP)) {
      return {
        allowed: false,
        error: "Rate limit exceeded",
        headers: {
          "X-RateLimit-Reset": options.rateLimiter
            .getResetTime(clientIP)
            .toString(),
        },
      };
    }

    // Origin validation
    if (
      options.allowedOrigins &&
      !validateOrigin(request, options.allowedOrigins)
    ) {
      return {
        allowed: false,
        error: "Invalid origin",
      };
    }

    // Cron secret validation
    if (options.requireCronSecret) {
      const secret = process.env.CRON_SECRET;
      if (!secret || !validateCronRequest(request, secret)) {
        return {
          allowed: false,
          error: "Unauthorized",
        };
      }
    }

    return {
      allowed: true,
      headers: getSecurityHeaders(),
    };
  };
}

// ====================================
// EXPORTS
// ====================================

export { RateLimiter, type RateLimitEntry };
