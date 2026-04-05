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

      // Check if Railway sent a real response or an HTML Error Page
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
      // 👇 LIE DETECTOR REMOVED - CLEAN CUSTOMER ERROR ADDED 👇
      console.error(`[API Error] ${endpoint}:`, err.message);
      alert("⚠️ Connection Error. Please check your internet and try again.");
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

// 👇 ─── SAFE INSTAGRAM OVERRIDE (PREMIUM UI/UX) ─── 👇
if (navigator.userAgent.includes('Instagram') || navigator.userAgent.includes('FB')) {
    const showPremiumBlocker = () => {
        const currentUrl = window.location.href;
        
        document.body.innerHTML = `
            <style>
                @keyframes bounceUpRight {
                    0%, 100% { transform: translate(0, 0); }
                    50% { transform: translate(8px, -8px); }
                }
                .animate-arrow { animation: bounceUpRight 1.5s infinite ease-in-out; }
                .copy-btn { background: transparent; color: #a1a1aa; border: 1px solid #3f3f46; padding: 14px 20px; border-radius: 12px; font-size: 15px; font-weight: 600; width: 100%; cursor: pointer; transition: all 0.2s; margin-top: 10px; }
                .copy-btn:active { transform: scale(0.97); }
            </style>

            <div style="background: rgba(0, 0, 0, 0.95); backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px); height: 100vh; width: 100vw; display: flex; align-items: center; justify-content: center; text-align: center; color: white; font-family: 'Inter', sans-serif; padding: 20px; box-sizing: border-box; position: fixed; top: 0; left: 0; z-index: 999999;">
                
                <div class="animate-arrow" style="position: absolute; top: 40px; right: 25px; display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                    <span style="font-weight: 600; font-size: 14px; color: #000; background: #fff; padding: 6px 12px; border-radius: 20px; box-shadow: 0 4px 12px rgba(255,255,255,0.2);">Tap the 3 dots</span>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(-45deg);">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                </div>

                <div style="background: #0a0a0a; padding: 32px 24px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.08); width: 100%; max-width: 360px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8);">
                    
                    <div style="background: linear-gradient(135deg, #27272a, #18181b); width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; border: 1px solid rgba(255,255,255,0.05); box-shadow: inset 0 2px 10px rgba(255,255,255,0.05);">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    </div>
                    
                    <h2 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">Action Required</h2>
                    <p style="color: #a1a1aa; line-height: 1.5; font-size: 15px; margin: 0 0 28px;">Instagram limits secure payments. Follow these quick steps to continue safely.</p>

                    <div style="background: #111; padding: 16px; border-radius: 16px; border: 1px solid #222; margin-bottom: 24px; display: flex; flex-direction: column; gap: 16px;">
                        <div style="display: flex; align-items: center; gap: 14px; text-align: left;">
                            <div style="background: #27272a; color: #fff; width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0;">1</div>
                            <div style="font-size: 14px; color: #e4e4e7;">Tap the <strong>3 dots (⋮)</strong> top right</div>
                        </div>
                        <div style="height: 1px; background: #222; width: 100%;"></div>
                        <div style="display: flex; align-items: center; gap: 14px; text-align: left;">
                            <div style="background: #27272a; color: #fff; width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0;">2</div>
                            <div style="font-size: 14px; color: #e4e4e7;">Select <strong>Open in System Browser</strong></div>
                        </div>
                    </div>

                    <button class="copy-btn" onclick="navigator.clipboard.writeText('${currentUrl}'); this.innerText='✓ Copied! Now open Chrome/Safari and paste'; this.style.color='#fff'; this.style.borderColor='#fff'; this.style.background='#27272a'; setTimeout(() => {this.innerText='Copy Link Instead'; this.style.color='#a1a1aa'; this.style.borderColor='#3f3f46'; this.style.background='transparent';}, 5000);">Copy Link Instead</button>
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
