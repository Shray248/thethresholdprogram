// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — AUTHENTICATION MIDDLEWARE
// Guards protected routes with JWT verification.
// ═══════════════════════════════════════════════════════════

const { verifyToken } = require('../utils/jwt');
const prisma = require('../lib/prisma');

/**
 * requireAuth — Core authentication middleware.
 *
 * Extracts the Bearer token from the Authorization header,
 * verifies it, and attaches the full user object to req.user.
 * Rejects with 401 if token is missing/invalid, or if the
 * user no longer exists in the database.
 */
async function requireAuth(req, res, next) {
  try {
    // ─── Extract token from header ─────────────────────
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No authentication token provided.',
      });
    }

    const token = authHeader.split(' ')[1];

    // ─── Verify JWT signature and expiration ───────────
    const decoded = verifyToken(token);

    // ─── Fetch fresh user from database ────────────────
    // We always re-fetch to ensure the user hasn't been
    // deleted or had their access revoked since the token
    // was issued.
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        email: true,
        role: true,
        accessLevel: true,
        hasPurchased: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User account no longer exists.',
      });
    }

    // Attach user to request for downstream handlers
    req.user = user;
    next();
  } catch (error) {
    // JWT verification errors (expired, malformed, etc.)
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token has expired. Please log in again.',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token. Authentication failed.',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Internal authentication error.',
    });
  }
}

/**
 * requirePurchased — Authorization middleware.
 *
 * Must be used AFTER requireAuth. Ensures the authenticated
 * user has actually purchased the program before accessing
 * premium course content.
 */
function requirePurchased(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required.',
    });
  }

  if (!req.user.hasPurchased && req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. You must purchase The Threshold Program to access this content.',
    });
  }

  next();
}

/**
 * requireAdmin — Admin-only middleware.
 *
 * Must be used AFTER requireAuth. Restricts access to
 * admin-level operations like managing users or viewing
 * all transactions.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Administrator privileges required.',
    });
  }

  next();
}

module.exports = { requireAuth, requirePurchased, requireAdmin };
