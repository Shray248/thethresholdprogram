// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — API CLIENT
// Application-first purchase model — no user authentication.
// Handles application submission → Razorpay checkout integration.
// ═══════════════════════════════════════════════════════════

// 👇 YAHAN MAINE LINK UPDATE KAR DIYA HAI 👇
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:4000/api'
  : 'https://179qncu6.up.railway.app/api';

const api = {
  /**
   * Core fetch wrapper. No authentication token for public routes.
   */
  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Inject admin token if present (for admin routes)
    const token = localStorage.getItem('admin_token');
    if (token && !options.skipAuth) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'API Request Failed');
      }

      return data;
    } catch (err) {
      console.error(`[API Error] ${endpoint}:`, err.message);
      throw err;
    }
  },

  // ═══════════════════════════════════════════════════════════
  // PAYMENT ENDPOINTS — PUBLIC (no authentication required)
  // ═══════════════════════════════════════════════════════════

  payments: {
    /**
     * POST /api/payments/create-order
     * Creates a Razorpay order with buyer application data.
     */
    async createOrder(buyerInfo) {
      const res = await api.request('/payments/create-order', {
        method: 'POST',
        body: JSON.stringify(buyerInfo),
      });
      return res.data;
    },

    /**
     * POST /api/payments/verify
     * Verifies the payment after Razorpay checkout completes.
     */
    async verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature) {
      const res = await api.request('/payments/verify', {
        method: 'POST',
        body: JSON.stringify({ razorpay_order_id, razorpay_payment_id, razorpay_signature }),
      });
      return res;
    },

    /**
     * Initiates Razorpay checkout with buyer info prefilled.
     * Called from the application form after collecting buyer details.
     *
     * @param {Object} buyerInfo - { name, email, phone, instagram, currentSituation, investmentCapacity }
     */
    async initiateCheckout(buyerInfo) {
      // 1. Create the order on our backend with buyer info
      const orderData = await this.createOrder(buyerInfo);

      // 2. Load the Razorpay script if not already on the page
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = resolve;
          script.onerror = () => reject(new Error('Could not load payment gateway.'));
          document.body.appendChild(script);
        });
      }

      // 3. Initialize Razorpay checkout with prefilled buyer info
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'The Threshold Program',
        description: '7-Day Threshold Program — 7 Live 1-on-1 Sessions',
        order_id: orderData.orderId,
        prefill: orderData.prefill || {},
        theme: {
          color: '#000000',
        },
        handler: async function (response) {
          // Payment successful — verify on backend
          try {
            await api.payments.verifyPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature,
            );
            // Show success page
            window.location.href = '/success.html';
          } catch (err) {
            alert('Payment received but verification failed. Please contact support.');
          }
        },
      };

      const rzp = new window.Razorpay(options);

      rzp.on('payment.failed', function (response) {
        alert('Payment Failed: ' + response.error.description);
      });

      rzp.open();
      return orderData;
    },
  },

  // ═══════════════════════════════════════════════════════════
  // AUTH ENDPOINTS — ADMIN ONLY
  // ═══════════════════════════════════════════════════════════

  auth: {
    /**
     * POST /api/auth/admin-login
     */
    async login(email, password) {
      const res = await api.request('/auth/admin-login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        skipAuth: true,
      });
      if (res.data?.token) {
        localStorage.setItem('admin_token', res.data.token);
      }
      return res.data;
    },

    /**
     * GET /api/auth/me — Admin profile
     */
    async getMe() {
      const res = await api.request('/auth/me');
      return res.data?.admin;
    },

    /**
     * Clear admin session
     */
    logout() {
      localStorage.removeItem('admin_token');
    },
  },

  // ═══════════════════════════════════════════════════════════
  // ADMIN ENDPOINTS — PROTECTED (requires admin JWT)
  // ═══════════════════════════════════════════════════════════

  admin: {
    /**
     * GET /api/admin/stats — Revenue & analytics
     */
    async getStats() {
      const res = await api.request('/admin/stats');
      return res.data;
    },

    /**
     * GET /api/admin/orders — Paginated order list
     */
    async getOrders(page = 1, limit = 20, search = '', status = '') {
      const params = new URLSearchParams({ page, limit });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      const res = await api.request(`/admin/orders?${params}`);
      return res.data;
    },

    /**
     * GET /api/admin/orders/:id — Order detail
     */
    async getOrderDetail(id) {
      const res = await api.request(`/admin/orders/${id}`);
      return res.data;
    },

    /**
     * PATCH /api/admin/orders/:id/status — Update order status
     */
    async updateOrderStatus(id, status) {
      const res = await api.request(`/admin/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      return res.data;
    },
  },

  // ═══════════════════════════════════════════════════════════
  // HEALTH CHECK
  // ═══════════════════════════════════════════════════════════

  async healthCheck() {
    try {
      const res = await fetch(`${API_BASE}/health`);
      return await res.json();
    } catch {
      return { success: false, status: 'unreachable' };
    }
  },
};
