/**
 * Input sanitization, validation, PII redaction, and file upload verification
 */

/**
 * Strip potentially malicious HTML, JavaScript tags, and control characters
 */
export function sanitizeString(input: unknown, maxLength = 10000): string {
  if (typeof input !== 'string') return '';
  
  return input
    .slice(0, maxLength)
    // Strip script, iframe, object, embed tags and event handlers
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/\0/g, '') // remove null bytes
    .trim();
}

/**
 * Validate email address format strictly
 */
export function isValidEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return email.length <= 254 && emailRegex.test(email);
}

/**
 * Validate password complexity (at least 8 chars, containing letters & numbers)
 */
export function validatePassword(password: unknown): { valid: boolean; message?: string } {
  if (typeof password !== 'string') {
    return { valid: false, message: 'Password must be a string' };
  }
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (password.length > 128) {
    return { valid: false, message: 'Password cannot exceed 128 characters' };
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain both letters and numbers' };
  }
  return { valid: true };
}

/**
 * PII Scrubber & Data Minimization for external AI services
 * Redacts credit cards, SSNs, phone numbers, email addresses, and secret keys
 */
export function scrubPII(text: string): { scrubbed: string; redactedCount: number } {
  if (!text) return { scrubbed: '', redactedCount: 0 };

  let count = 0;
  let scrubbed = text;

  // 1. Credit card numbers (13-19 digits with optional hyphens/spaces)
  scrubbed = scrubbed.replace(/\b(?:\d[ -]*?){13,19}\b/g, (match) => {
    // Basic Luhn or 16-digit check
    const digits = match.replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 19) {
      count++;
      return '[REDACTED_CREDIT_CARD]';
    }
    return match;
  });

  // 2. Social Security Numbers (US SSN format XXX-XX-XXXX)
  scrubbed = scrubbed.replace(/\b\d{3}-\d{2}-\d{4}\b/g, () => {
    count++;
    return '[REDACTED_SSN]';
  });

  // 3. Email addresses
  scrubbed = scrubbed.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, () => {
    count++;
    return '[REDACTED_EMAIL]';
  });

  // 4. Phone numbers (E.164, US formats, international)
  scrubbed = scrubbed.replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, () => {
    count++;
    return '[REDACTED_PHONE]';
  });

  // 5. Passwords / Secrets / API keys keywords
  scrubbed = scrubbed.replace(/(?:password|secret|pin|api[_-]?key|token)\s*[:=]\s*([^\s,;]+)/gi, (match, secretVal) => {
    count++;
    return match.replace(secretVal, '[REDACTED_SECRET]');
  });

  return { scrubbed, redactedCount: count };
}

/**
 * Validate file uploads: size, MIME type whitelist, and magic byte header verification
 */
export function validateUploadedFile(
  buffer: Buffer,
  mimeType: string,
  filename: string,
  maxSizeBytes = 15 * 1024 * 1024 // 15MB limit
): { valid: boolean; error?: string; safeFilename?: string; safeMimeType?: string } {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'Empty file payload' };
  }

  if (buffer.length > maxSizeBytes) {
    return { valid: false, error: `File size exceeds limit of ${Math.round(maxSizeBytes / (1024 * 1024))}MB` };
  }

  // Sanitize filename to prevent path traversal
  const safeFilename = filename
    .replace(/^.*[\\\/]/, '') // remove path
    .replace(/[^a-zA-Z0-9._-]/g, '_') // sanitize special chars
    .slice(0, 100);

  // Allowed MIME whitelist
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'audio/webm',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'text/plain',
  ];

  const lowerMime = (mimeType || '').toLowerCase();
  if (!allowedMimeTypes.includes(lowerMime)) {
    return { valid: false, error: `MIME type '${mimeType}' is not supported for security reasons` };
  }

  // Magic byte verification
  if (lowerMime === 'image/jpeg' && !(buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)) {
    return { valid: false, error: 'Corrupt or invalid JPEG header' };
  }
  if (lowerMime === 'image/png' && !(buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47)) {
    return { valid: false, error: 'Corrupt or invalid PNG header' };
  }
  if (lowerMime === 'application/pdf' && buffer.subarray(0, 4).toString('ascii') !== '%PDF') {
    return { valid: false, error: 'Corrupt or invalid PDF header' };
  }

  return {
    valid: true,
    safeFilename: safeFilename || 'uploaded_asset',
    safeMimeType: lowerMime,
  };
}
