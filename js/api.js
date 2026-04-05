// ═══════════════════════════════════════════════════════════
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

      // 🚨 DEEP FIX: Check if Railway sent a real response or an HTML Error Page
      const contentType = response.headers.get("content-type");
      let data;
      if (contentType && contentType.includes("application/json")) {
          data = await response.json();
      } else {
          // Agar Railway down hai ya crash ho gaya hai
          throw new Error(`Railway Server Error! Status: ${response.status}. Expected JSON but got something else.`);
      }

      if (!response.ok) {
        throw new Error(data.error || `API Request Failed (Status: ${response.status})`);
      }

      return data;
    } catch (err) {
      // 👇 YEH NAYI LINE ASLI ERROR SCREEN PAR DIKHAYEGI 👇
      alert("🚨 REAL SYSTEM ERROR:\n\n" + err.message + "\n\nEndpoint: " + endpoint);
      console.error(`[API Error] ${endpoint}:`, err.message);
      throw err;
    }
  },

  // ═══════════════════════════════════════════════════════════
  // PAYMENT ENDPOINTS — PUBLIC (no authentication required)
  // ═══════════════════════════════════════════════════════════

  payments: {
    async createOrder(buyerInfo) {
      const res = await api.request('/payments/create-order', {
        method: 'POST',
        body: JSON.stringify(buyerInfo),
      });
      return res.data;
    },

    async verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature) {
      const res = await api.request('/payments/verify', {
        method: 'POST',
        body: JSON.stringify({ razorpay_order_id, razorpay_payment_id, razorpay_signature }),
      });
      return res;
    },

    async initiateCheckout(buyerInfo) {
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
          try {
            await api.payments.verifyPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature,
            );
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
    async getMe() {
      const res = await api.request('/auth/me');
      return res.data?.admin;
    },
    logout() {
      localStorage.removeItem('admin_token');
    },
  },

  // ═══════════════════════════════════════════════════════════
  // ADMIN ENDPOINTS — PROTECTED (requires admin JWT)
  // ═══════════════════════════════════════════════════════════

  admin: {
    async getStats() {
      const res = await api.request('/admin/stats');
      return res.data;
    },
    async getOrders(page = 1, limit = 20, search = '', status = '') {
      const params = new URLSearchParams({ page, limit });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      const res = await api.request(`/admin/orders?${params}`);
      return res.data;
    },
    async getOrderDetail(id) {
      const res = await api.request(`/admin/orders/${id}`);
      return res.data;
    },
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

// 👇 ─── SAFE INSTAGRAM OVERRIDE (FILE KE END MEIN) ─── 👇
if (navigator.userAgent.includes('Instagram') || navigator.userAgent.includes('FB')) {
    const showPremiumBlocker = () => {
        document.body.innerHTML = `
            <div style="background: #000; height: 100vh; width: 100vw; display: flex; align-items: center; justify-content: center; text-align: center; color: white; font-family: 'Inter', sans-serif; padding: 20px; box-sizing: border-box; position: fixed; top: 0; left: 0; z-index: 999999;">
                <div style="background: #111; padding: 40px 25px; border-radius: 16px; border: 1px solid #333; width: 100%; max-width: 360px; box-shadow: 0 20px 40px rgba(0,0,0,0.8);">
                    <div style="background: #222; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 28px;">🔒</div>
                    <h2 style="margin: 0 0 15px; font-size: 22px; font-weight: 600;">Secure Checkout</h2>
                    <p style="color: #aaa; line-height: 1.6; font-size: 15px; margin: 0 0 20px;">Instagram browser blocks secure payments. To continue, tap the <strong>3 dots (⋮)</strong> at the top right and select:</p>
                    <div style="background: #333; padding: 12px 15px; border-radius: 8px; color: #fff; font-weight: 500; display: inline-block;">Open in System Browser</div>
                </div>
            </div>
        `;
    };

    if (document.body) {
        showPremiumBlocker();
    } else {
        window.addEventListener('DOMContentLoaded', showPremiumBlocker);
    }
}
// 👆 ────────────────────────────────────────────────── 👆
