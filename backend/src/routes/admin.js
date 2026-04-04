// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — ADMIN ROUTES
// GET    /api/admin/stats           → Revenue & analytics
// GET    /api/admin/users           → Paginated user list
// GET    /api/admin/users/:id       → User detail
// PATCH  /api/admin/users/:id/access → Grant/revoke access
// GET    /api/admin/orders          → Paginated order list
//
// All routes require authentication + admin role.
// ═══════════════════════════════════════════════════════════

const express = require('express');
const {
  listUsers,
  getUserDetail,
  updateUserAccess,
  listOrders,
  getStats,
} = require('../controllers/adminController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ─── All admin routes are doubly protected ───────────────
// 1. requireAuth — verifies JWT and user exists
// 2. requireAdmin — ensures user.role === 'ADMIN'
router.use(requireAuth, requireAdmin);

// Dashboard analytics
router.get('/stats', getStats);

// User management
router.get('/users', listUsers);
router.get('/users/:id', getUserDetail);
router.patch('/users/:id/access', updateUserAccess);

// Order management
router.get('/orders', listOrders);

module.exports = router;
