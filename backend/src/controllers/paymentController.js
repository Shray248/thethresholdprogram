// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — PAYMENT CONTROLLER
// Razorpay Orders + Webhook handler.
// Supports native INR transactions via UPI, Netbanking & Cards.
// ═══════════════════════════════════════════════════════════

const Razorpay = require('razorpay');
const crypto = require('crypto');
const config = require('../config');
const prisma = require('../lib/prisma');

const razorpay = new Razorpay({
  key_id: config.razorpay.keyId,
  key_secret: config.razorpay.keySecret,
});

// ─── Supported currencies and their pricing ──────────────
const SUPPORTED_CURRENCIES = ['usd', 'eur', 'gbp', 'inr'];

/**
 * Resolves the price for a product in the requested currency.
 * Falls back to INR if the currency isn't supported (since primary market is India).
 */
function resolvePrice(productType, currency) {
  const normalizedCurrency = (currency || 'inr').toLowerCase();
  const validCurrency = SUPPORTED_CURRENCIES.includes(normalizedCurrency)
    ? normalizedCurrency
    : 'inr';

  const priceMap = productType === 'private_session'
    ? config.pricing.privateSession
    : config.pricing.fullProgram;

  return {
    amount: priceMap[validCurrency],
    currency: validCurrency.toUpperCase(), // Razorpay expects uppercase 'INR', 'USD' etc.
  };
}

/**
 * POST /api/payments/create-razorpay-order
 *
 * Creates a Razorpay Order for either the full
 * program or a 1-on-1 private session.
 */
async function createRazorpayOrder(req, res) {
  try {
    const { productType = 'full_program', currency = 'inr' } = req.body;
    const user = req.user; // Set by requireAuth middleware

    // ─── Validate product type ────────────────────────
    const validProducts = ['full_program', 'private_session'];
    if (!validProducts.includes(productType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid product type. Must be one of: ${validProducts.join(', ')}`,
      });
    }

    // ─── Check if user already purchased the program ──
    if (productType === 'full_program' && user.hasPurchased) {
      return res.status(400).json({
        success: false,
        error: 'You have already purchased The Threshold Program.',
      });
    }

    // ─── Resolve pricing for the requested currency ───
    const pricing = resolvePrice(productType, currency);

    // ─── Create Razorpay Order ───────────────────────
    // Razorpay requires amounts to be in the smallest currency unit (e.g. paise for INR).
    const options = {
      amount: pricing.amount,
      currency: pricing.currency,
      receipt: `receipt_${user.id.substring(0, 8)}_${Date.now()}`,
      notes: {
        userId: user.id,
        productType,
      },
    };

    const order = await razorpay.orders.create(options);

    // ─── Create pending order in database ────────────
    await prisma.order.create({
      data: {
        userId: user.id,
        razorpayOrderId: order.id,
        amount: pricing.amount,
        currency: pricing.currency.toLowerCase(),
        status: 'PENDING',
        productType: productType === 'private_session' ? 'PRIVATE_SESSION' : 'FULL_PROGRAM',
      },
    });

    console.log(`💳 Razorpay Order created for ${user.email} — ${productType} (${pricing.currency} ${pricing.amount})`);

    return res.status(200).json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: config.razorpay.keyId,
        userEmail: user.email,
        userName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : '',
      },
    });
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Could not create payment order. Please try again.',
    });
  }
}

/**
 * POST /api/payments/webhook
 *
 * ⚠️  CRITICAL ENDPOINT
 *
 * Razorpay sends events here after payment actions. We verify
 * the webhook signature using crypto.createHmac.
 */
async function handleWebhook(req, res) {
  const webhookSignature = req.headers['x-razorpay-signature'];
  const webhookSecret = config.razorpay.webhookSecret;

  if (!webhookSignature) {
    console.error('⚠️  Webhook received without signature');
    return res.status(400).json({ error: 'Missing Razorpay signature.' });
  }

  // ─── Verify signature ──────────────────────────────
  // We use req.rawBody which was captured in server.js
  const generatedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(req.rawBody)
    .digest('hex');

  if (generatedSignature !== webhookSignature) {
    console.error('⚠️  Webhook signature mismatch');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // ─── Process the event ──────────────────────────────
  const event = req.body;
  console.log(`📩 Razorpay event received: ${event.event}`);

  try {
    switch (event.event) {
      case 'order.paid':
      case 'payment.captured': {
        const paymentData = event.payload.payment.entity;
        const orderId = paymentData.order_id;
        
        // We might not have metadata on the payment level, but we have the order
        const dbOrder = await prisma.order.findUnique({
          where: { razorpayOrderId: orderId },
        });

        if (dbOrder && dbOrder.status !== 'COMPLETED') {
          await handleSuccessfulPayment(dbOrder, paymentData.id, generatedSignature);
        }
        break;
      }
      
      case 'payment.failed': {
        const paymentData = event.payload.payment.entity;
        console.log(`❌ Payment failed for order ${paymentData.order_id}`);
        break;
      }
      
      default:
        console.log(`ℹ️  Unhandled event type: ${event.event}`);
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error(`❌ Error processing webhook event:`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ═══════════════════════════════════════════════════════════
// INTERNAL EVENT HANDLERS
// ═══════════════════════════════════════════════════════════

async function handleSuccessfulPayment(order, paymentId, signature) {
  console.log(`✅ Payment successful for order ${order.razorpayOrderId}`);

  // ─── Update order status ────────────────────────────
  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: 'COMPLETED',
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
    },
  });

  // ─── Grant access based on product type ─────────────
  const updateData = {};

  if (order.productType === 'FULL_PROGRAM') {
    updateData.hasPurchased = true;
    updateData.accessLevel = 'FULL_PROGRAM';
  } else if (order.productType === 'PRIVATE_SESSION') {
    const currentUser = await prisma.user.findUnique({
      where: { id: order.userId },
      select: { accessLevel: true },
    });

    if (currentUser?.accessLevel !== 'FULL_PROGRAM') {
      updateData.accessLevel = 'SESSION_ONLY';
    }
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.user.update({
      where: { id: order.userId },
      data: updateData,
    });
  }

  console.log(`🔓 Access granted for user ${order.userId}`);
}

module.exports = { createRazorpayOrder, handleWebhook };
