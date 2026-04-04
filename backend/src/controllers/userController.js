// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — USER CONTROLLER
// Self-service user management: change password, view order
// history, verify payment status, and account management.
// ═══════════════════════════════════════════════════════════

const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const config = require('../config');
const { validatePassword } = require('../utils/validators');

/**
 * PUT /api/user/password
 *
 * Allows an authenticated user to change their password.
 * Requires the current password for verification.
 *
 * Request body:
 *   - currentPassword: string
 *   - newPassword: string
 */
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // ─── Input validation ──────────────────────────────
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required.',
      });
    }

    // Validate new password strength
    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
      return res.status(400).json({
        success: false,
        error: passwordCheck.error,
      });
    }

    // Prevent setting the same password
    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        error: 'New password must be different from the current password.',
      });
    }

    // ─── Fetch user with password hash ─────────────────
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found.',
      });
    }

    // ─── Verify current password ───────────────────────
    const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect.',
      });
    }

    // ─── Hash and save new password ────────────────────
    const newHash = await bcrypt.hash(newPassword, config.bcryptSaltRounds);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    console.log(`🔑 Password changed for user ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully.',
    });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({
      success: false,
      error: 'Could not change password. Please try again.',
    });
  }
}

/**
 * GET /api/user/orders
 *
 * Returns the authenticated user's order/transaction history.
 * Sorted by most recent first.
 */
async function getOrderHistory(req, res) {
  try {
    const userId = req.user.id;

    const orders = await prisma.order.findMany({
      where: { userId },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        productType: true,
        receiptUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // ─── Format amounts for display ──────────────────────
    const formattedOrders = orders.map((order) => ({
      ...order,
      formattedAmount: formatCurrency(order.amount, order.currency),
    }));

    return res.status(200).json({
      success: true,
      data: { orders: formattedOrders },
    });
  } catch (error) {
    console.error('Order history error:', error);
    return res.status(500).json({
      success: false,
      error: 'Could not fetch order history.',
    });
  }
}

/**
 * GET /api/user/verify-payment/:sessionId
 *
 * Verifies a payment's status after Stripe redirects the user
 * back to the frontend. Checks both our database and Stripe
 * for the definitive status.
 *
 * This is called by the frontend's success/cancel pages to
 * confirm the payment went through before showing content.
 */
async function verifyPayment(req, res) {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required.',
      });
    }

    // ─── Look up the order in our database ─────────────
    const order = await prisma.order.findFirst({
      where: {
        stripeSessionId: sessionId,
        userId, // Ensure the order belongs to this user
      },
      select: {
        id: true,
        status: true,
        amount: true,
        currency: true,
        productType: true,
        createdAt: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Payment session not found.',
      });
    }

    // ─── Re-fetch user access state ─────────────────────
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        hasPurchased: true,
        accessLevel: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        payment: {
          ...order,
          formattedAmount: formatCurrency(order.amount, order.currency),
        },
        access: {
          hasPurchased: user.hasPurchased,
          accessLevel: user.accessLevel,
        },
      },
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    return res.status(500).json({
      success: false,
      error: 'Could not verify payment.',
    });
  }
}

/**
 * PUT /api/user/profile
 *
 * Updates the authenticated user's profile information.
 *
 * Request body:
 *   - firstName: string (optional)
 *   - lastName: string (optional)
 */
async function updateProfile(req, res) {
  try {
    const userId = req.user.id;
    const { firstName, lastName } = req.body;

    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName?.trim() || null;
    if (lastName !== undefined) updateData.lastName = lastName?.trim() || null;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update.',
      });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        accessLevel: true,
        hasPurchased: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: { user },
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({
      success: false,
      error: 'Could not update profile.',
    });
  }
}

/**
 * DELETE /api/user/account
 *
 * Permanently deletes the authenticated user's account and
 * all associated data. This action is irreversible.
 * Requires password confirmation for safety.
 *
 * Request body:
 *   - password: string (confirmation)
 */
async function deleteAccount(req, res) {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password confirmation is required to delete your account.',
      });
    }

    // ─── Verify password ───────────────────────────────
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, email: true },
    });

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect password.',
      });
    }

    // ─── Delete user (cascades to orders + progress) ───
    await prisma.user.delete({ where: { id: userId } });

    console.log(`🗑️  Account deleted: ${user.email}`);

    return res.status(200).json({
      success: true,
      message: 'Your account has been permanently deleted.',
    });
  } catch (error) {
    console.error('Account deletion error:', error);
    return res.status(500).json({
      success: false,
      error: 'Could not delete account. Please try again.',
    });
  }
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Formats a currency amount (in smallest unit) to a
 * human-readable string, e.g. 49700 -> "$497.00"
 */
function formatCurrency(amount, currency) {
  const currencySymbols = {
    usd: '$',
    eur: '€',
    gbp: '£',
    inr: '₹',
  };

  const symbol = currencySymbols[currency.toLowerCase()] || currency.toUpperCase();
  const divisor = currency.toLowerCase() === 'inr' ? 100 : 100;
  const formatted = (amount / divisor).toFixed(2);

  return `${symbol}${formatted}`;
}

module.exports = {
  changePassword,
  getOrderHistory,
  verifyPayment,
  updateProfile,
  deleteAccount,
};
