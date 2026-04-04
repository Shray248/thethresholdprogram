// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — AUTHENTICATION CONTROLLER
// Handles user registration, login, and profile retrieval.
// All passwords hashed with bcrypt. Tokens issued via JWT.
// ═══════════════════════════════════════════════════════════

const bcrypt = require('bcryptjs');
const config = require('../config');
const prisma = require('../lib/prisma');
const { generateToken } = require('../utils/jwt');

// ─── Email validation regex ──────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Password requirements ──────────────────────────────
const MIN_PASSWORD_LENGTH = 8;

/**
 * POST /api/auth/register
 *
 * Creates a new user account with a hashed password.
 * Returns a JWT token upon successful registration.
 */
async function register(req, res) {
  try {
    const { email, password, firstName, lastName } = req.body;

    // ─── Input validation ──────────────────────────────
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required.',
      });
    }

    // Validate email format
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address.',
      });
    }

    // Validate password strength
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
      });
    }

    // ─── Check for existing user ───────────────────────
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email already exists.',
      });
    }

    // ─── Hash password ─────────────────────────────────
    // bcrypt with configurable salt rounds (default 12)
    const passwordHash = await bcrypt.hash(password, config.bcryptSaltRounds);

    // ─── Create user ───────────────────────────────────
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
      },
      select: {
        id: true,
        email: true,
        role: true,
        accessLevel: true,
        hasPurchased: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });

    // ─── Generate JWT ──────────────────────────────────
    const token = generateToken(user);

    console.log(`✅ New user registered: ${user.email}`);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      error: 'An error occurred during registration. Please try again.',
    });
  }
}

/**
 * POST /api/auth/login
 *
 * Authenticates a user with email and password.
 * Returns a JWT token upon successful authentication.
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    // ─── Input validation ──────────────────────────────
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required.',
      });
    }

    // ─── Find user by email ────────────────────────────
    // IMPORTANT: We fetch the passwordHash here for comparison.
    // This field is never returned to the client.
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // ─── Verify credentials ────────────────────────────
    // Use the same error message for both "user not found"
    // and "wrong password" to prevent email enumeration.
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    // ─── Generate JWT ──────────────────────────────────
    const token = generateToken(user);

    console.log(`✅ User logged in: ${user.email}`);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          accessLevel: user.accessLevel,
          hasPurchased: user.hasPurchased,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'An error occurred during login. Please try again.',
    });
  }
}

/**
 * GET /api/auth/me
 *
 * Returns the authenticated user's profile.
 * Requires a valid JWT token (use requireAuth middleware).
 */
async function getProfile(req, res) {
  try {
    // req.user is populated by the requireAuth middleware
    return res.status(200).json({
      success: true,
      data: { user: req.user },
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return res.status(500).json({
      success: false,
      error: 'Could not fetch profile.',
    });
  }
}

module.exports = { register, login, getProfile };
