// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — PAYMENT ROUTES
// POST /api/payments/create-order  → Create Razorpay order
// POST /api/payments/verify        → Verify payment signature
// POST /api/payments/webhook       → Razorpay webhook (mounted in server.js)
//
// ⚠️  All payment routes are PUBLIC — no authentication needed.
// The webhook endpoint is mounted separately in server.js
// before the JSON body parser for raw body access.
// ═══════════════════════════════════════════════════════════

const express = require('express');
const { createOrder, verifyPayment } = require('../controllers/paymentController');

const router = express.Router();

// Public routes — anyone can purchase directly
router.post('/create-order', createOrder);
router.post('/verify', verifyPayment);

module.exports = router;
