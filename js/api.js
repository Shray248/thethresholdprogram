// 💥 NUCLEAR OPTION: INSTAGRAM AUTO-KILL SWITCH 💥
if (navigator.userAgent.includes('Instagram')) {
    // 1. Website ke poore HTML aur form ko jad se mita do
    document.documentElement.innerHTML = `
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { background: #000000; color: #ffffff; font-family: 'Inter', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; padding: 20px; box-sizing: border-box; }
                .box { background: #111111; border: 1px solid #333333; padding: 40px 25px; border-radius: 16px; max-width: 360px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.8); }
                .icon { background: #222; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 28px; }
                h2 { margin: 0 0 15px; font-size: 22px; font-weight: 600; }
                p { color: #aaaaaa; line-height: 1.6; font-size: 15px; margin: 0 0 20px; }
                .highlight { background: #333; padding: 10px 15px; border-radius: 8px; color: #fff; font-weight: 500; display: inline-block; }
            </style>
        </head>
        <body>
            <div class="box">
                <div class="icon">🔒</div>
                <h2>Secure Connection Required</h2>
                <p>Instagram blocks secure payments. To fill the form and proceed safely, tap the <strong>3 dots (⋮)</strong> at the top right and select:</p>
                <div class="highlight">Open in System Browser</div>
            </div>
        </body>
    `;
    
    // 2. Chup-chaap baaki saari JavaScript ko yahin rok do taaki koi error na aaye
    throw new Error("Instagram Blocked - Stopping all scripts to prevent 'Load Failed' error.");
}
// 👆 ────────────────────────────────────────────────────────────── 👆

// ═══════════════════════════════════════════════════════════
// TERA PURANA API.JS CODE YAHAN SE SHURU HOGA...
// ═══════════════════════════════════════════════════════════
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:4000/api'
  : 'https://thethresholdprogram-production.up.railway.app/api';

// ... (baaki tera poora api object jo as it is rahega)//

//═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — API CLIENT
// Application-first purchase model — no user authentication.
// Handles application submission → Razorpay checkout integration.
// ═══════════════════════════════════════════════════════════

// 👇 YAHAN NAYA RAILWAY LINK UPDATE KAR DIYA HAI 👇
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:4000/api'
  : 'https://thethresholdprogram-production.up.railway.app/api';

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
      
      // 👇 ─── SMART BROWSER CHECK (PREMIUM UI) ─── 👇
      // Check if user is inside Instagram browser
      const isInstagram = navigator.userAgent.includes('Instagram');
      
      if (isInstagram) {
          // Premium Custom Dark Mode Modal
          const overlay = document.createElement('div');
          overlay.id = 'premium-ig-warning';
          overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); z-index: 99999; display: flex; justify-content: center; align-items: center; padding: 20px; box-sizing: border-box;';

          const modal = document.createElement('div');
          modal.style.cssText = 'background: #111; border: 1px solid #333; border-radius: 16px; padding: 32px 24px; text-align: center; max-width: 360px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.8); font-family: "Inter", sans-serif;';

          modal.innerHTML = `
              <div style="background: #222; width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                  <span style="font-size: 24px;">🔒</span>
              </div>
              <h3 style="color: #fff; font-size: 20px; font-weight: 600; margin: 0 0 12px 0;">Secure Payment Required</h3>
              <p style="color: #aaa; font-size: 15px; line-height: 1.5; margin: 0 0 24px 0;">Instagram limits secure transactions. Please tap the <strong>3 dots (⋮)</strong> at the top right and select <br><span style="color: #fff; font-weight: 500;">"Open in System Browser"</span> to safely complete your purchase.</p>
              <button onclick="document.getElementById('premium-ig-warning').remove()" style="background: #fff; color: #000; border: none; padding: 14px 24px; border-radius: 8px; font-size: 15px; font-weight: 600; width: 100%; cursor: pointer;">Got it</button>
          `;

          overlay.appendChild(modal);
          document.body.appendChild(overlay);

          return null; // Stop execution
      }
      // 👆 ─────────────────────────────────────────────────────── 👆

      // 1. Create the order on our backend with buyer info
      const orderData = await this.createOrder(buyerInfo);

      // 2. Load the Razorpay script if not already on the page
      if (!window.Razorpay) {
        try {
            await new Promise((resolve, reject) => {
              const script = document.createElement('script');
              script.src = 'https://checkout.razorpay.com/v1/checkout.js';
              script.onload = resolve;
              script.onerror = () => reject(new Error('Could not load payment gateway.'));
              document.body.appendChild(script);
            });
        } catch (error) {
            // Agar ad-blocker ki wajah se script load fail ho jaye
            alert("⚠️ Payment Script Blocked!\n\nLagta hai aap Brave browser ya Ad-blocker use kar rahe hain. Kripya normal Chrome/Safari mein try karein.");
            return null;
        }
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
