import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import env from "@/env";

/**
 * Security Headers Middleware
 *
 * Adds standard security headers to all responses to protect against common web vulnerabilities:
 * - HSTS: Forces HTTPS connections
 * - X-Frame-Options: Prevents clickjacking
 * - X-Content-Type-Options: Prevents MIME sniffing
 * - X-XSS-Protection: Enables browser XSS protection
 * - Referrer-Policy: Controls referrer information
 * - Permissions-Policy: Restricts browser features
 * - Content-Security-Policy: Prevents XSS and other injection attacks
 */
const securityHeaders = createMiddleware(async (c: Context, next) => {
  await next();

  // Only set HSTS in production and over HTTPS
  if (env.NODE_ENV === "production") {
    // Strict-Transport-Security: Force HTTPS for 1 year, including subdomains
    c.header(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  // X-Frame-Options: Prevent clickjacking by disallowing embedding in frames
  c.header("X-Frame-Options", "DENY");

  // X-Content-Type-Options: Prevent MIME type sniffing
  c.header("X-Content-Type-Options", "nosniff");

  // X-XSS-Protection: Enable browser's built-in XSS protection (legacy support)
  c.header("X-XSS-Protection", "1; mode=block");

  // Referrer-Policy: Control how much referrer information is sent
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions-Policy: Restrict access to browser features
  c.header(
    "Permissions-Policy",
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
  );

  // Content-Security-Policy: Prevent XSS and other injection attacks
  // This is a restrictive policy - adjust based on your needs
  const cspDirectives = [
    "default-src 'self'", // Only allow resources from same origin by default
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net", // Allow inline scripts and Scalar API reference CDN
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net", // Allow inline styles and Scalar CDN stylesheets
    "img-src 'self' data: https:", // Allow images from same origin, data URIs, and HTTPS
    "font-src 'self' data: https://cdn.jsdelivr.net", // Allow fonts from same origin, data URIs, and Scalar CDN
    "connect-src 'self'", // Only allow API calls to same origin
    "frame-ancestors 'none'", // Don't allow embedding (similar to X-Frame-Options)
    "base-uri 'self'", // Restrict base tag URLs
    "form-action 'self'", // Restrict form submissions
    "upgrade-insecure-requests", // Upgrade HTTP to HTTPS in production
  ];

  c.header("Content-Security-Policy", cspDirectives.join("; "));

  // X-Powered-By: Remove to avoid revealing technology stack
  // (Hono doesn't set this by default, but this explicitly removes it if set)
  c.header("X-Powered-By", "");
});

export default securityHeaders;
