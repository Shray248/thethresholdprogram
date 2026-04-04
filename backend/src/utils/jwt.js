// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — JWT UTILITY MODULE
// Handles token generation and verification.
// Uses RS256-compatible HS256 with a strong secret.
// ═══════════════════════════════════════════════════════════

const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Generates a signed JWT for an authenticated user.
 * Payload includes only the minimum data needed for
 * authorization — never include sensitive data in JWTs.
 *
 * @param {Object} user - The user object from the database
 * @returns {string} Signed JWT token
 */
function generateToken(user) {
  const payload = {
    sub: user.id,           // Subject — the user's UUID
    email: user.email,
    role: user.role,
    accessLevel: user.accessLevel,
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    issuer: 'threshold-program',
    audience: 'threshold-frontend',
  });
}

/**
 * Verifies and decodes a JWT token.
 * Throws an error if the token is invalid, expired, or tampered with.
 *
 * @param {string} token - The JWT token to verify
 * @returns {Object} Decoded payload
 */
function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret, {
    issuer: 'threshold-program',
    audience: 'threshold-frontend',
  });
}

module.exports = { generateToken, verifyToken };
