import { z } from "zod";
import DOMPurify from "isomorphic-dompurify";
import validator from "validator";
import { NextRequest } from "next/server";
import crypto from "crypto";

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

export function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

export function sanitizeEmail(email: string): string {
  const cleaned = validator.normalizeEmail(email.trim().toLowerCase()) || "";

  const sanitized = sanitizeHtml(cleaned);

  EmailSchema.parse(sanitized);

  return sanitized;
}

export function sanitizeString(
  input: string,
  maxLength: number = 1000
): string {
  const sanitized = sanitizeHtml(input.trim());

  if (sanitized.length > maxLength) {
    throw new Error(`Input too long (max ${maxLength} characters)`);
  }

  return sanitized;
}

export function sanitizeVPSModel(model: any): number {
  const numModel = typeof model === "string" ? parseInt(model, 10) : model;

  return VPSModelSchema.parse(numModel);
}

export function sanitizeDatacenter(datacenter: any): string {
  const strDatacenter = String(datacenter).toUpperCase().trim();

  const sanitized = sanitizeHtml(strDatacenter);

  return DatacenterSchema.parse(sanitized);
}

/**
 * Validate and sanitize token
 */
export const sanitizeToken = (token: string): string => {
  const cleaned = token.trim().toLowerCase();

  if (!/^[a-f0-9]{32}$/.test(cleaned)) {
    throw new Error("Invalid token format");
  }

  return cleaned;
};

export function escapeSQLString(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\x1a/g, "\\Z");
}

export function validateSQLParams(params: any[]): any[] {
  return params.map((param) => {
    if (typeof param === "string") {
      const sanitized = sanitizeString(param, 1000);

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

    return sanitizeString(String(param), 1000);
  });
}

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
      this.store.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      entry.blocked = true;
      return false;
    }

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

export const subscriptionRateLimiter = new RateLimiter(300000, 10);
export const emailRateLimiter = new RateLimiter(3600000, 5);
export const generalRateLimiter = new RateLimiter(60000, 100);

export function getClientIP(request: NextRequest): string {
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

export function validateOrigin(
  request: NextRequest,
  allowedOrigins: string[]
): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (!origin && !referer) {
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

  return crypto.timingSafeEqual(
    new Uint8Array(Buffer.from(providedSecret)),
    new Uint8Array(Buffer.from(secret))
  );
}

export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length / 2).toString("hex");
}

export function hashData(data: string, salt?: string): string {
  const actualSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.createHmac("sha256", actualSalt);
  hash.update(data);
  return hash.digest("hex");
}

export function validateFileUpload(
  filename: string,
  mimetype: string,
  size: number,
  maxSize: number = 1024 * 1024
): boolean {
  if (size > maxSize) {
    throw new Error(`File too large (max ${maxSize} bytes)`);
  }

  const sanitizedName = sanitizeString(filename, 255);
  if (
    sanitizedName.includes("..") ||
    sanitizedName.includes("/") ||
    sanitizedName.includes("\\")
  ) {
    throw new Error("Invalid filename");
  }

  const allowedTypes = ["text/plain", "application/json", "text/csv"];
  if (!allowedTypes.includes(mimetype)) {
    throw new Error("File type not allowed");
  }

  return true;
}

export function getSecurityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",

    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",

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

    "Referrer-Policy": "strict-origin-when-cross-origin",

    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
}

export function sanitizeError(
  error: any,
  isProduction: boolean = true
): string {
  if (!isProduction) {
    return String(error.message || error);
  }

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

    if (
      options.allowedOrigins &&
      !validateOrigin(request, options.allowedOrigins)
    ) {
      return {
        allowed: false,
        error: "Invalid origin",
      };
    }

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

export { RateLimiter, type RateLimitEntry };
