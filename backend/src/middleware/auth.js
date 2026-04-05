// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — AUTH MIDDLEWARE
// Guards admin routes with JWT verification.
// Simplified — no buyer authentication needed.
// ═══════════════════════════════════════════════════════════

const { verifyToken } = require('../utils/jwt');
const prisma = require('../lib/prisma');

/**
 * requireAdmin — Admin authentication middleware.
 *
 * Extracts the Bearer token from the Authorization header,
 * verifies it, and confirms the user is an admin.
 */
async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No authentication token provided.',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    // Verify this is an admin account
    const admin = await prisma.adminUser.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Admin account not found.',
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token has expired. Please log in again.',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token.',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Internal authentication error.',
    });
  }
}

module.exports = { requireAdmin };
