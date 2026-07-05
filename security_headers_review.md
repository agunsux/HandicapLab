# HandicapLab Security Headers Review

This document logs security headers enforced at the entry point of all HandicapLab API endpoints.

---

## 1. Configured Headers

Enforced via standard Next.js headers option in `next.config.ts`:

- **Access-Control-Allow-Origin:** `*` (Configures resource sharing defaults for clients).
- **Access-Control-Allow-Methods:** `GET, POST, OPTIONS, DELETE` (Limits HTTP request options).
- **Access-Control-Allow-Headers:** `Content-Type, Authorization` (Permitted custom headers).
- **X-Content-Type-Options:** `nosniff` (Prevents MIME sniffing vulnerabilities).
- **X-Frame-Options:** `DENY` (Protects against clickjacking on UI embeds).
- **X-XSS-Protection:** `1; mode=block` (Blocks cross-site scripting page loads).
- **Referrer-Policy:** `strict-origin-when-cross-origin` (Reduces header referral leaks).
