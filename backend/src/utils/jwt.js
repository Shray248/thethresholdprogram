// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — JWT UTILITY MODULE
// Handles token generation and verification for admin auth.
// ═══════════════════════════════════════════════════════════

const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Generates a signed JWT for an authenticated admin.
 *
 * @param {Object} admin - The admin object from the database
 * @returns {string} Signed JWT token
 */
function generateToken(admin) {
  const payload = {
    sub: admin.id,
    email: admin.email,
    role: admin.role || 'ADMIN',
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    issuer: 'threshold-program',
    audience: 'threshold-admin',
  });
}

/**
 * Verifies and decodes a JWT token.
 *
 * @param {string} token - The JWT token to verify
 * @returns {Object} Decoded payload
 */
function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret, {
    issuer: 'threshold-program',
    audience: 'threshold-admin',
  });
}

module.exports = { generateToken, verifyToken };
