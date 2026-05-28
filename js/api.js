/**
 * The Threshold Program — API Client
 * Handles lead capture, booking, and payment endpoints.
 */

const API_BASE = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000/api' 
  : '/api';

const api = {
  // ══════════════════════════════════════════
  // LEAD CAPTURE
  // ══════════════════════════════════════════
  leads: {
    /**
     * Capture an email for the free resource lead magnet.
     * @param {string} email 
     * @returns {Promise<object>}
     */
    async captureEmail(email) {
      try {
        const res = await fetch(`${API_BASE}/leads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, source: 'free_resource' }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to save email.');
        }

        return await res.json();
      } catch (err) {
        // Silent fail for lead capture — don't block the download
        console.warn('Lead capture failed:', err.message);
        return { success: false };
      }
    },
  },

  // ══════════════════════════════════════════
  // BOOKINGS
  // ══════════════════════════════════════════
  bookings: {
    /**
     * Get available time slots for a specific date.
     * @param {string} date — YYYY-MM-DD format
     * @returns {Promise<object>}
     */
    async getAvailableSlots(date) {
      try {
        const res = await fetch(`${API_BASE}/bookings/slots?date=${date}`);
        if (!res.ok) throw new Error('Failed to fetch slots.');
        return await res.json();
      } catch (err) {
        console.warn('Slots fetch failed:', err.message);
        return { slots: [] };
      }
    },

    /**
     * Create a booking.
     * @param {object} data — { name, email, phone, struggle, sessionDate, sessionTime }
     * @returns {Promise<object>}
     */
    async createBooking(data) {
      const res = await fetch(`${API_BASE}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create booking.');
      }

      return await res.json();
    },
  },

  // ══════════════════════════════════════════
  // PAYMENTS (Razorpay)
  // ══════════════════════════════════════════
  payments: {
    /**
     * Initiate a Razorpay checkout for a booking.
     * @param {object} data — { name, email, phone, struggle, sessionDate, sessionTime, amount }
     */
    async initiateCheckout(data) {
      // Step 1: Create the order on the backend
      const res = await fetch(`${API_BASE}/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: data.amount || 4999,
          currency: 'INR',
          name: data.name,
          email: data.email,
          phone: data.phone,
          struggle: data.struggle,
          sessionDate: data.sessionDate,
          sessionTime: data.sessionTime,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Could not create payment order.');
      }

      const response = await res.json();
      const order = response.data;

      // Step 2: Open Razorpay checkout
      return new Promise((resolve, reject) => {
        if (typeof Razorpay === 'undefined') {
          // Load Razorpay script dynamically if not already loaded
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => openRazorpay(order, data, resolve, reject);
          script.onerror = () => reject(new Error('Failed to load Razorpay.'));
          document.head.appendChild(script);
        } else {
          openRazorpay(order, data, resolve, reject);
        }
      });
    },
  },
};

/**
 * Open the Razorpay checkout modal.
 */
function openRazorpay(order, data, resolve, reject) {
  const options = {
    key: order.keyId || order.key_id,
    amount: order.amount,
    currency: order.currency || 'INR',
    name: 'The Threshold Program',
    description: `Breakthrough Session — ${data.sessionDate} at ${data.sessionTime}`,
    order_id: order.orderId || order.id,
    prefill: {
      name: data.name,
      email: data.email,
      contact: data.phone,
    },
    theme: {
      color: '#000000',
    },
    handler: async function (response) {
      try {
        // Verify payment on backend
        const verifyRes = await fetch(`${API_BASE}/payments/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          }),
        });

        if (verifyRes.ok) {
          // Redirect to success page with booking details
          const params = new URLSearchParams({
            date: data.sessionDate,
            time: data.sessionTime,
            name: data.name,
          });
          window.location.href = `/success.html?${params.toString()}`;
          resolve(response);
        } else {
          reject(new Error('Payment verification failed. Please contact support.'));
        }
      } catch (err) {
        reject(new Error('Payment verification failed. Please contact support.'));
      }
    },
    modal: {
      ondismiss: function () {
        reject(new Error('Payment was cancelled.'));
      },
    },
  };

  const rzp = new Razorpay(options);
  rzp.on('payment.failed', function (response) {
    reject(new Error(response.error.description || 'Payment failed. Please try again.'));
  });
  rzp.open();
}
