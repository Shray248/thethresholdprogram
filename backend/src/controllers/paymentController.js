// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — PAYMENT CONTROLLER
// Application-first purchase flow — no authentication required.
// Collects buyer info from application form → creates Razorpay order.
// ═══════════════════════════════════════════════════════════

const Razorpay = require('razorpay');
const crypto = require('crypto');
const config = require('../config');
const prisma = require('../lib/prisma');

const razorpay = new Razorpay({
  key_id: config.razorpay.keyId,
  key_secret: config.razorpay.keySecret,
});

/**
 * POST /api/payments/create-order
 */
async function createOrder(req, res) {
  try {
    const {
      name,
      email,
      phone,
      instagram,
      currentSituation,
      investmentCapacity,
    } = req.body;

    // ─── Validate required fields ────────────────────
    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and phone are required.',
      });
    }

    // ─── Bulletproof Amount Logic ────────────────────
    // Direct Rupees value (e.g. 5000)
    const rawAmount = 24500; 
    const amountInPaise = rawAmount * 100; 

    // ─── Create Razorpay Order ───────────────────────
    const options = {
      amount: Math.floor(amountInPaise), // Ensure it's a solid integer
      currency: 'INR',
      receipt: `ttp_${Date.now()}`,
      notes: {
        product: 'threshold_7day_program',
        description: '7-Day Threshold Program — 7 Live 1-on-1 Sessions',
        buyer_name: name,
        buyer_email: email,
        buyer_phone: phone,
      },
    };

    const order = await razorpay.orders.create(options);

    // ─── Create pending order in database ─────────────
    await prisma.order.create({
      data: {
        razorpayOrderId: order.id,
        amount: rawAmount,
        currency: 'INR',
        status: 'PENDING',
        buyerName: name.trim(),
        buyerEmail: email.trim().toLowerCase(),
        buyerPhone: phone.trim(),
        buyerInstagram: instagram?.trim() || null,
        currentSituation: currentSituation?.trim() || null,
        investmentCapacity: investmentCapacity || null,
      },
    });

    console.log(`💳 Order created: ${order.id} — ₹${rawAmount}`);

    return res.status(200).json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: config.razorpay.keyId,
        prefill: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          contact: phone.trim(),
        },
      },
    });
  } catch (error) {
    // Logging the full error for Railway logs
    console.error('Razorpay order creation error details:', JSON.stringify(error, null, 2));
    return res.status(500).json({
      success: false,
      error: 'Could not create payment order. Please try again.',
    });
  }
}

/**
 * POST /api/payments/verify
 */
async function verifyPayment(req, res) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing payment verification data.',
      });
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', config.razorpay.keySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Payment verification failed.',
      });
    }

    const dbOrder = await prisma.order.findUnique({
      where: { razorpayOrderId: razorpay_order_id },
    });

    if (!dbOrder) {
      return res.status(404).json({ success: false, error: 'Order not found.' });
    }

    await prisma.order.update({
      where: { id: dbOrder.id },
      data: {
        status: 'COMPLETED',
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully!',
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    return res.status(500).json({
      success: false,
      error: 'Payment verification failed.',
    });
  }
}

/**
 * POST /api/payments/webhook
 */
async function handleWebhook(req, res) {
  const webhookSignature = req.headers['x-razorpay-signature'];
  const webhookSecret = config.razorpay.webhookSecret;

  if (!webhookSignature) return res.status(400).json({ error: 'No signature' });

  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const generatedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (generatedSignature !== webhookSignature) return res.status(400).json({ error: 'Invalid sig' });

  const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  try {
    if (event.event === 'order.paid' || event.event === 'payment.captured') {
      const orderId = event.payload.payment.entity.order_id;
      const dbOrder = await prisma.order.findUnique({ where: { razorpayOrderId: orderId } });

      if (dbOrder && dbOrder.status !== 'COMPLETED') {
        await prisma.order.update({
          where: { id: dbOrder.id },
          data: { 
            status: 'COMPLETED',
            razorpayPaymentId: event.payload.payment.entity.id 
          },
        });
      }
    }
    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error(`Webhook error:`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { createOrder, verifyPayment, handleWebhook };
