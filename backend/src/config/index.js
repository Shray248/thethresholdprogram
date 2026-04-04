// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — CENTRALIZED CONFIGURATION
// Validates all environment variables at boot time.
// If any required value is missing, the server won't start.
// ═══════════════════════════════════════════════════════════

require('dotenv').config();

/**
 * Validates that a required environment variable exists.
 * Throws immediately on missing values — fail fast, fail loud.
 */
function requireEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`❌ Missing required environment variable: ${key}`);
  }
  return value;
}

const config = {
  // ─── Server ────────────────────────────────────────────
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 4000,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // ─── Database ──────────────────────────────────────────
  databaseUrl: requireEnv('DATABASE_URL'),

  // ─── JWT ───────────────────────────────────────────────
  jwt: {
    secret: requireEnv('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // ─── Bcrypt ────────────────────────────────────────────
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,

  // ─── Razorpay ──────────────────────────────────────────
  razorpay: {
    keyId: requireEnv('RAZORPAY_KEY_ID'),
    keySecret: requireEnv('RAZORPAY_KEY_SECRET'),
    webhookSecret: requireEnv('RAZORPAY_WEBHOOK_SECRET'),
  },

  // ─── Course Pricing (in smallest unit: cents/paise) ────
  pricing: {
    fullProgram: {
      usd: parseInt(process.env.COURSE_PRICE_USD, 10) || 49700,
      eur: parseInt(process.env.COURSE_PRICE_EUR, 10) || 45700,
      gbp: parseInt(process.env.COURSE_PRICE_GBP, 10) || 39700,
      inr: parseInt(process.env.COURSE_PRICE_INR, 10) || 4150000,
    },
    privateSession: {
      usd: parseInt(process.env.SESSION_PRICE_USD, 10) || 19700,
      eur: parseInt(process.env.SESSION_PRICE_EUR, 10) || 17700,
      gbp: parseInt(process.env.SESSION_PRICE_GBP, 10) || 14700,
      inr: parseInt(process.env.SESSION_PRICE_INR, 10) || 1650000,
    },
  },
};

module.exports = config;
