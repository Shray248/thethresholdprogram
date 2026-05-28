// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — CENTRALIZED CONFIGURATION
// Validates all environment variables at boot time.
// Simplified for direct-purchase model.
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

  // ─── JWT (Admin only) ─────────────────────────────────
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

  // ─── Program Pricing (in paise) ────────────────────────
  // 1 Breakthrough Session = ₹1,999 = 199,900 paise
  pricing: {
    programPriceInr: parseInt(process.env.PROGRAM_PRICE_INR, 10) || 199900,
  },
};

module.exports = config;
