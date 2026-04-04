// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — PAYMENT ROUTES
// POST /api/payments/create-razorpay-order
// POST /api/payments/webhook
//
// ⚠️  IMPORTANT: The webhook endpoint is NOT mounted here.
// It's mounted in server.js BEFORE the JSON body parser
// so Razorpay receives the raw request body it needs for
// HMAC signature verification.
// ═══════════════════════════════════════════════════════════

const express = require('express');
const { createRazorpayOrder } = require('../controllers/paymentController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Protected route — user must be logged in to purchase
router.post('/create-razorpay-order', requireAuth, createRazorpayOrder);

module.exports = router;
