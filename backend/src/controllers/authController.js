// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — AUTH CONTROLLER
// Admin-only authentication. No buyer accounts needed.
// ═══════════════════════════════════════════════════════════

const bcrypt = require('bcryptjs');
const config = require('../config');
const prisma = require('../lib/prisma');
const { generateToken } = require('../utils/jwt');

/**
 * POST /api/auth/admin-login
 *
 * Authenticates an admin user with email and password.
 * Returns a JWT token upon successful authentication.
 * Only AdminUser accounts can log in.
 */
async function adminLogin(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required.',
      });
    }

    // Find admin by email
    const admin = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials.',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials.',
      });
    }

    // Generate JWT
    const token = generateToken({
      id: admin.id,
      email: admin.email,
      role: 'ADMIN',
    });

    console.log(`✅ Admin logged in: ${admin.email}`);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({
      success: false,
      error: 'An error occurred during login.',
    });
  }
}

/**
 * GET /api/auth/me
 *
 * Returns the authenticated admin's profile.
 */
async function getProfile(req, res) {
  try {
    return res.status(200).json({
      success: true,
      data: { admin: req.admin },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Could not fetch profile.',
    });
  }
}

module.exports = { adminLogin, getProfile };
