// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — INPUT VALIDATION UTILITIES
// Centralized validation functions used across controllers.
// Keeps validation logic DRY and consistent.
// ═══════════════════════════════════════════════════════════

/**
 * RFC 5322-compliant email regex (simplified).
 * Catches the vast majority of invalid emails without
 * being so strict that it rejects valid ones.
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Password must be at least 8 characters and contain:
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

/**
 * UUID v4 format validator.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates an email address.
 * @param {string} email
 * @returns {{ valid: boolean, error?: string }}
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required.' };
  }

  const cleaned = email.trim().toLowerCase();

  if (!EMAIL_REGEX.test(cleaned)) {
    return { valid: false, error: 'Please provide a valid email address.' };
  }

  if (cleaned.length > 254) {
    return { valid: false, error: 'Email address is too long.' };
  }

  return { valid: true };
}

/**
 * Validates a password against strength requirements.
 * @param {string} password
 * @param {boolean} strict - If true, enforces uppercase + number requirement
 * @returns {{ valid: boolean, error?: string }}
 */
function validatePassword(password, strict = false) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required.' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }

  if (password.length > 128) {
    return { valid: false, error: 'Password must not exceed 128 characters.' };
  }

  if (strict && !PASSWORD_REGEX.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number.',
    };
  }

  return { valid: true };
}

/**
 * Validates a UUID v4 string.
 * @param {string} id
 * @returns {boolean}
 */
function isValidUUID(id) {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

/**
 * Sanitizes a string by trimming whitespace and removing
 * potentially dangerous characters for display contexts.
 * This is NOT a substitute for parameterized queries (which
 * Prisma handles), but prevents XSS in rendered output.
 *
 * @param {string} input
 * @param {number} maxLength
 * @returns {string}
 */
function sanitizeString(input, maxLength = 255) {
  if (!input || typeof input !== 'string') return '';
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, ''); // Strip angle brackets to prevent HTML injection
}

/**
 * Validates that a value is one of the allowed options.
 * @param {string} value
 * @param {string[]} allowed
 * @returns {boolean}
 */
function isOneOf(value, allowed) {
  return allowed.includes(value);
}

module.exports = {
  validateEmail,
  validatePassword,
  isValidUUID,
  sanitizeString,
  isOneOf,
  EMAIL_REGEX,
  PASSWORD_REGEX,
  UUID_REGEX,
};
