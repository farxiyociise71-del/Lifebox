# Implementation Plan - Security-First LIFEBOX Architecture

## Security Threat Model

### Component Overview
LIFEBOX is a personal "Second Brain" web application allowing users to capture, organize, and query sensitive life data (documents, scans, notes, receipts, medical records, financial files, voice memos). The application features a client-side React SPA communicating with a Node.js/Express backend server that proxies AI requests to Gemini and manages data persistence, authentication, session tokens, encryption, and audit logs.

### Entry Points and Untrusted Inputs
| Entry Point | Type | Trusted? | Validation |
|---|---|---|---|
| `POST /api/auth/register`, `POST /api/auth/login` | HTTP REST | No | Strict schema validation, email format, password complexity, brute force lockout |
| `POST /api/auth/verify-pin` | HTTP REST | No | 4-6 digit numeric check, timing-safe equality, max 5 failed attempts lockout |
| `POST /api/auth/logout`, `GET /api/auth/sessions`, `DELETE /api/auth/sessions/:id` | HTTP REST | No | Bearer token authorization, active session verification |
| `POST /api/items`, `PUT /api/items/:id` | HTTP REST | No | Input sanitization (strip malicious HTML/scripts, length limits, category whitelist, payload size limits) |
| `POST /api/items/encrypt`, `POST /api/items/decrypt` | HTTP REST | No | Session check + user PIN verification, cryptographic key derivation, AES-256-GCM auth tag verification |
| `POST /api/upload` | HTTP REST / Multipart | No | File size limits (max 10MB), MIME type whitelist (image/*, application/pdf, audio/*), magic byte verification, safe filename generation |
| `POST /api/ai/ocr`, `POST /api/ai/ask`, `POST /api/ai/summarize`, `POST /api/ai/quiz` | HTTP REST | No | Authentication required, PII sanitization/redaction, strict payload limits, exclusion of locked/sensitive items |
| `POST /api/privacy/export`, `POST /api/privacy/delete-account` | HTTP REST | No | Re-authentication / password confirmation, complete atomic removal of user data |

### Trust Boundaries and Auth Assumptions
- **Authentication**: Stateful cryptographic session tokens generated via `crypto.randomBytes(32).toString('hex')` with expiry and sliding renewal. Stored server-side with client IP, user agent, and timestamp.
- **Authorization**: All item, collection, session, and AI operations enforce ownership checks (`userId === session.userId`). Users cannot read or manipulate items belonging to other users.
- **Implicit Trust Elimination**: Client-side storage is treated as an untrusted cache. Sensitive items are stored encrypted at rest on the server. Decryption keys are derived server-side via PBKDF2 with user-specific salts only upon valid authentication.
- **Boundary Crossings**:
  - Browser Client -> Express API: Encrypted via HTTPS/TLS, strict CORS, Security headers (HSTS, CSP, X-Content-Type-Options, X-Frame-Options).
  - Express Server -> Google Gemini API: API key never leaves the backend. Data sent to Gemini is strictly minimized and redacted of PII (credit cards, SSNs, phone numbers, emails, passwords).

### Sensitive Data Paths
| Data Type | Source | Destination | Protection |
|---|---|---|---|
| Gemini API Key | Server `.env` | Google GenAI SDK | Never sent to browser, read only at server startup |
| Passwords & PINs | User Login Form | Server Auth Store | Hashed using PBKDF2-SHA512 with unique 16-byte salt (100,000 iterations); timing-safe comparison |
| Sensitive Vault Items | User Input / Camera Scanner | Server Encrypted Store | Encrypted at rest using AES-256-GCM with 256-bit derived key, random 96-bit IV, and 128-bit auth tag |
| Session Tokens | Server Auth Handler | Client Local Storage / Header | Bearer token over HTTPS, validated against active session table with expiration and revocation |
| AI Prompt Data | User Notes / Scans | Gemini API | PII scrubber masks sensitive entities; vault/locked items excluded by default |

### Privileged Actions
| Action | Location | Guard |
|---|---|---|
| AI Processing | `server/ai.ts` | Authenticated session + PII redaction filter |
| Item Decryption | `server/crypto.ts` | Authenticated session + valid user PIN/password |
| Revoke Session | `server/routes/auth.ts` | Authenticated session + owner verification |
| Account Deletion | `server/routes/auth.ts` | Password verification + full server data purge |
| Data Export | `server/routes/auth.ts` | Authenticated session + rate limiting |

### Priority Review Areas
1. **Zero Secret Leakage**: Verify no API keys or server secrets appear in client bundle or network responses.
2. **Password & PIN Security**: Ensure no plaintext passwords or PINs in memory persistence or transit.
3. **Server-Side Authorization**: Ensure all item operations validate session token and reject unauthorized access.
4. **Data Minimization for AI**: Ensure personal data (credit cards, IDs, passwords, emails) is redacted before hitting external AI services.
5. **Brute-Force & Rate Limiting**: Ensure authentication endpoints lock out attackers after repeated failures.

---

## Proposed Changes

### 1. Server Security Architecture
- Implement `server/security/crypto.ts`:
  - Secure password and PIN hashing with PBKDF2 (100k iterations, SHA-512, unique salt).
  - Timing-safe comparison using `crypto.timingSafeEqual`.
  - AES-256-GCM authenticated encryption and decryption for sensitive vault items.
- Implement `server/security/rateLimit.ts`:
  - IP and account-based rate limiter.
  - Brute-force protection for `/api/auth/login` and `/api/auth/verify-pin` (lockout after 5 failed attempts for 15 minutes, exponential backoff).
- Implement `server/security/sanitizer.ts`:
  - Input validation and sanitization against XSS, script injection, and oversized payloads.
  - PII redaction filter for text sent to AI services (redacting emails, phone numbers, SSNs, credit card numbers).
  - File upload validator checking MIME type and binary signatures.
- Implement `server/security/session.ts`:
  - Session manager with cryptographically secure session IDs, device/user-agent parsing, IP logging, last-active timestamps, and revocation.
- Implement `server/routes/`:
  - `/api/auth`: Register, Login, Verify PIN, Current Session, All Sessions, Revoke Session, Update Password/PIN, Delete Account.
  - `/api/items`: CRUD with server-side authorization, encrypted storage for sensitive items, search.
  - `/api/privacy`: Export all user data (sanitized/decrypted archive), telemetry/AI preferences, complete account wipe.
  - `/api/ai`: Protected routes with data minimization and PII scrubbing before Gemini API calls.

### 2. Client Security Integration
- Update `src/services/api.ts` or `src/services/storage.ts`:
  - Authenticate against server endpoints using Bearer tokens.
  - Automatically sync encrypted vault items.
  - Device/Session management view in Settings: view active sessions (devices, browsers, IPs, times) with one-click revocation.
  - Privacy & Data governance controls: Data export download, Account deletion with password confirmation, AI data minimization toggle.

### 3. Verification Plan

### Security Verification
- **Security Scan**: Inspect all newly created and modified files for common CWE vulnerabilities (XSS, injection, exposed secrets, missing auth boundaries). Resolve any detected issues immediately.
- **Security Audit**: Audit the implementation against the component's threat model (`## Security Threat Model`). Document all findings, dispositions, and remediations in `walkthrough.md` using the `generate-security-audit-report` skill.
- **PoC Verification**: Validate brute-force lockout, unauthorized data access prevention, and PII redaction in `walkthrough.md` using the `run-poc` skill.
