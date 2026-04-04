// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — USER ROUTES
// PUT    /api/user/password                 → Change password
// PUT    /api/user/profile                  → Update profile
// GET    /api/user/orders                   → Order history
// GET    /api/user/verify-payment/:sessionId → Verify payment
// DELETE /api/user/account                  → Delete account
//
// All routes require authentication.
// ═══════════════════════════════════════════════════════════

const express = require('express');
const {
  changePassword,
  getOrderHistory,
  verifyPayment,
  updateProfile,
  deleteAccount,
} = require('../controllers/userController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// All user routes require authentication
router.use(requireAuth);

// Profile management
router.put('/profile', updateProfile);
router.put('/password', changePassword);

// Order & payment
router.get('/orders', getOrderHistory);
router.get('/verify-payment/:sessionId', verifyPayment);

// Account deletion (destructive — requires password confirmation)
router.delete('/account', deleteAccount);

module.exports = router;
