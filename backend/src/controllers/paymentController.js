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
 *
 * Creates a Razorpay Order for the 7-day Threshold Program.
 * PUBLIC endpoint — no authentication required.
 * Accepts buyer application info (name, email, phone, instagram,
 * currentSituation, investmentCapacity) and stores it with the order.
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

    // Fixed amount logic - Make sure it's valid and converted to PAISE for Razorpay
    let rawAmount = config.pricing.programPriceInr;
    if (!rawAmount || isNaN(rawAmount)) {
        rawAmount = 5000; // Default fallback to 5000 INR if config fails
    }
    
    // Razorpay needs amount in Paise
    const amountInPaise = parseInt(rawAmount) * 100; 

    // ─── Create Razorpay Order ───────────────────────
    const options = {
      amount: amountInPaise, 
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

    // ─── Create pending order in database with buyer info ──
    await prisma.order.create({
      data: {
        razorpayOrderId: order.id,
        amount: parseInt(rawAmount), // Save standard INR in DB
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

    console.log(`💳 Order created: ${order.id} — ${name} (${email}) — ₹${rawAmount.toLocaleString()}`);

    return res.status(200).json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: config.razorpay.keyId,
        // Prefill data for Razorpay checkout
        prefill: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          contact: phone.trim(),
        },
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
 * POST /api/payments/verify
 *
 * Called by the frontend after Razorpay checkout completes.
 * Verifies the payment signature and marks the order as complete.
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

    // ─── Verify signature ────────────────────────────
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', config.razorpay.keySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.error('⚠️  Payment signature verification failed');
      return res.status(400).json({
        success: false,
        error: 'Payment verification failed. Please contact support.',
      });
    }

    // ─── Fetch payment details from Razorpay ─────────
    let paymentDetails;
    try {
      paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
    } catch (fetchErr) {
      console.error('Error fetching payment details:', fetchErr);
    }

    // ─── Update order in database ────────────────────
    const dbOrder = await prisma.order.findUnique({
      where: { razorpayOrderId: razorpay_order_id },
    });

    if (!dbOrder) {
      return res.status(404).json({
        success: false,
        error: 'Order not found.',
      });
    }

    // Update order — keep existing buyer info, add payment IDs
    const updateData = {
      status: 'COMPLETED',
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    };

    // Only overwrite buyer info from Razorpay if we don't already have it
    if (!dbOrder.buyerEmail && paymentDetails?.email) {
      updateData.buyerEmail = paymentDetails.email;
    }
    if (!dbOrder.buyerPhone && paymentDetails?.contact) {
      updateData.buyerPhone = paymentDetails.contact;
    }
    if (!dbOrder.buyerName && paymentDetails?.notes?.buyer_name) {
      updateData.buyerName = paymentDetails.notes.buyer_name;
    }

    await prisma.order.update({
      where: { id: dbOrder.id },
      data: updateData,
    });

    console.log(`✅ Payment verified: ${razorpay_payment_id} for order ${razorpay_order_id}`);
    console.log(`   📧 Buyer: ${dbOrder.buyerName} — ${dbOrder.buyerEmail}`);

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully. Welcome to The Threshold Program!',
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    return res.status(500).json({
      success: false,
      error: 'Payment verification failed. Please contact support.',
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
 * This is a fallback — the primary verification happens in /verify.
 */
async function handleWebhook(req, res) {
  const webhookSignature = req.headers['x-razorpay-signature'];
  const webhookSecret = config.razorpay.webhookSecret;

  if (!webhookSignature) {
    console.error('⚠️  Webhook received without signature');
    return res.status(400).json({ error: 'Missing Razorpay signature.' });
  }

  // ─── Verify signature ──────────────────────────────
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const generatedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (generatedSignature !== webhookSignature) {
    console.error('⚠️  Webhook signature mismatch');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // ─── Process the event ──────────────────────────────
  const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  console.log(`📩 Razorpay webhook event: ${event.event}`);

  try {
    switch (event.event) {
      case 'order.paid':
      case 'payment.captured': {
        const paymentData = event.payload.payment.entity;
        const orderId = paymentData.order_id;

        const dbOrder = await prisma.order.findUnique({
          where: { razorpayOrderId: orderId },
        });

        if (dbOrder && dbOrder.status !== 'COMPLETED') {
          await prisma.order.update({
            where: { id: dbOrder.id },
            data: {
              status: 'COMPLETED',
              razorpayPaymentId: paymentData.id,
              // Only fill buyer info if missing from application form
              ...(dbOrder.buyerEmail ? {} : { buyerEmail: paymentData.email || null }),
              ...(dbOrder.buyerPhone ? {} : { buyerPhone: paymentData.contact || null }),
            },
          });
          console.log(`✅ Webhook: Payment completed for order ${orderId}`);
        }
        break;
      }

      case 'payment.failed': {
        const paymentData = event.payload.payment.entity;
        const orderId = paymentData.order_id;

        const dbOrder = await prisma.order.findUnique({
          where: { razorpayOrderId: orderId },
        });

        if (dbOrder && dbOrder.status === 'PENDING') {
          await prisma.order.update({
            where: { id: dbOrder.id },
            data: {
              status: 'FAILED',
              failureReason: paymentData.error_description || 'Payment failed',
            },
          });
        }
        console.log(`❌ Payment failed for order ${orderId}`);
        break;
      }

      default:
        console.log(`ℹ️  Unhandled event: ${event.event}`);
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error(`❌ Webhook processing error:`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { createOrder, verifyPayment, handleWebhook };
