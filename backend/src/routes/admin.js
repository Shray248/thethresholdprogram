// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — ADMIN ROUTES
// GET    /api/admin/stats            → Revenue & analytics
// GET    /api/admin/orders           → Paginated order list
// GET    /api/admin/orders/:id       → Order detail
// PATCH  /api/admin/orders/:id/status → Update order status
//
// All routes require admin authentication.
// ═══════════════════════════════════════════════════════════

const express = require('express');
const {
  listOrders,
  getOrderDetail,
  updateOrderStatus,
  getStats,
} = require('../controllers/adminController');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require admin JWT
router.use(requireAdmin);

// Dashboard analytics
router.get('/stats', getStats);

// Order management
router.get('/orders', listOrders);
router.get('/orders/:id', getOrderDetail);
router.patch('/orders/:id/status', updateOrderStatus);

module.exports = router;
