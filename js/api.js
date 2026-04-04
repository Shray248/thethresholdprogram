// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — API & STATE MANAGEMENT
// Handles communication with the Node.js backend.
// Provides a clean interface for all API operations.
// ═══════════════════════════════════════════════════════════

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:4000/api'
  : 'https://api.' + window.location.hostname.replace('www.', '') + '/api';

const api = {
  /**
   * Retrieves the current JWT token from localStorage.
   */
  getToken() {
    return localStorage.getItem('threshold_token');
  },

  /**
   * Sets the JWT token and user data in localStorage.
   */
  setSession(token, user) {
    if (token) localStorage.setItem('threshold_token', token);
    if (user) localStorage.setItem('threshold_user', JSON.stringify(user));
  },

  /**
   * Retrieves user data from localStorage.
   */
  getUser() {
    const userStr = localStorage.getItem('threshold_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  /**
   * Clears session data (Logout).
   */
  clearSession() {
    localStorage.removeItem('threshold_token');
    localStorage.removeItem('threshold_user');
  },

  /**
   * Checks if the user is currently authenticated.
   */
  isAuthenticated() {
    return !!this.getToken();
  },

  /**
   * Checks if the current user has purchased the program.
   */
  hasPurchased() {
    const user = this.getUser();
    return user?.hasPurchased === true;
  },

  /**
   * Core fetch wrapper that automatically attaches the JWT token.
   * Handles auth expiry, error formatting, and response parsing.
   */
  async request(endpoint, options = {}) {
    const token = this.getToken();
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        // Automatically logout if token expired
        if (response.status === 401) {
          this.clearSession();
          // Dispatch a custom event so UI can react (e.g. show login modal)
          window.dispatchEvent(new Event('auth:unauthorized'));
        }
        throw new Error(data.error || 'API Request Failed');
      }

      return data;
    } catch (err) {
      console.error(`[API Error] ${endpoint}:`, err.message);
      throw err;
    }
  },

  // ═══════════════════════════════════════════════════════════
  // AUTHENTICATION ENDPOINTS
  // ═══════════════════════════════════════════════════════════

  auth: {
    /**
     * POST /api/auth/register
     * Creates a new user account and stores the session.
     */
    async register(firstName, lastName, email, password) {
      const res = await api.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ firstName, lastName, email, password }),
      });
      api.setSession(res.data.token, res.data.user);
      return res.data;
    },

    /**
     * POST /api/auth/login
     * Authenticates a user and stores the session.
     */
    async login(email, password) {
      const res = await api.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      api.setSession(res.data.token, res.data.user);
      return res.data;
    },

    /**
     * GET /api/auth/me
     * Fetches the current user's profile. Updates cached user.
     */
    async getMe() {
      const res = await api.request('/auth/me');
      api.setSession(null, res.data.user); // Update cached user
      return res.data.user;
    },
  },

  // ═══════════════════════════════════════════════════════════
  // USER MANAGEMENT ENDPOINTS
  // ═══════════════════════════════════════════════════════════

  user: {
    /**
     * PUT /api/user/profile
     * Updates the current user's name.
     */
    async updateProfile(firstName, lastName) {
      const res = await api.request('/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ firstName, lastName }),
      });
      api.setSession(null, res.data.user);
      return res.data;
    },

    /**
     * PUT /api/user/password
     * Changes the user's password. Requires current password.
     */
    async changePassword(currentPassword, newPassword) {
      const res = await api.request('/user/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      return res;
    },

    /**
     * GET /api/user/orders
     * Fetches the user's order/transaction history.
     */
    async getOrders() {
      const res = await api.request('/user/orders');
      return res.data.orders;
    },

    /**
     * GET /api/user/verify-payment/:sessionId
     * Verifies a payment after Stripe redirect.
     */
    async verifyPayment(sessionId) {
      const res = await api.request(`/user/verify-payment/${sessionId}`);
      return res.data;
    },

    /**
     * DELETE /api/user/account
     * Permanently deletes the user's account. Requires password.
     */
    async deleteAccount(password) {
      const res = await api.request('/user/account', {
        method: 'DELETE',
        body: JSON.stringify({ password }),
      });
      api.clearSession();
      return res;
    },
  },

  // ═══════════════════════════════════════════════════════════
  // PAYMENT ENDPOINTS
  // ═══════════════════════════════════════════════════════════

  payments: {
    /**
     * POST /api/payments/create-razorpay-order
     * Creates a Razorpay order from the backend.
     */
    async createRazorpayOrder(productType = 'full_program', currency = 'inr') {
      const res = await api.request('/payments/create-razorpay-order', {
        method: 'POST',
        body: JSON.stringify({ productType, currency }),
      });
      return res.data;
    },

    /**
     * Injects the Razorpay script and opens the checkout modal.
     */
    async initiateCheckout(productType = 'full_program', currency = 'inr') {
      // 1. Create the order on our backend
      const orderData = await this.createRazorpayOrder(productType, currency);
      
      // 2. Load the Razorpay script if it's not already on the page
      if (!window.Razorpay) {
        await new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = resolve;
          document.body.appendChild(script);
        });
      }

      // 3. Initialize Razorpay options
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'The Threshold Program',
        description: productType === 'private_session' ? '1-on-1 Private Deep Dive' : '7-Day Transformation Protocol',
        order_id: orderData.orderId,
        prefill: {
          name: orderData.userName,
          email: orderData.userEmail,
        },
        theme: {
          color: '#8b2c2c'
        },
        handler: function (response) {
          // Razorpay handles webhook silently on the backend, 
          // we can redirect or show success here
          window.location.href = '/dashboard.html';
        }
      };

      const rzp = new window.Razorpay(options);
      
      rzp.on('payment.failed', function (response){
        alert("Payment Failed: " + response.error.description);
      });
      
      rzp.open();
      return orderData;
    },
  },

  // ═══════════════════════════════════════════════════════════
  // COURSE ENDPOINTS
  // ═══════════════════════════════════════════════════════════

  course: {
    /**
     * GET /api/course/modules
     * Fetches all course modules with the user's progress.
     */
    async getModules() {
      const res = await api.request('/course/modules');
      return res.data;
    },

    /**
     * POST /api/course/progress
     * Marks a specific lesson as completed.
     */
    async markLessonComplete(moduleId, lessonId) {
      const res = await api.request('/course/progress', {
        method: 'POST',
        body: JSON.stringify({ moduleId, lessonId }),
      });
      return res.data;
    },
  },

  // ═══════════════════════════════════════════════════════════
  // ADMIN ENDPOINTS
  // ═══════════════════════════════════════════════════════════

  admin: {
    /**
     * GET /api/admin/stats
     * Fetches revenue analytics and business metrics.
     */
    async getStats() {
      const res = await api.request('/admin/stats');
      return res.data;
    },

    /**
     * GET /api/admin/users
     * Fetches a paginated list of all users.
     */
    async getUsers(page = 1, limit = 20, search = '', role = '') {
      const params = new URLSearchParams({ page, limit });
      if (search) params.set('search', search);
      if (role) params.set('role', role);

      const res = await api.request(`/admin/users?${params.toString()}`);
      return res.data;
    },

    /**
     * GET /api/admin/users/:id
     * Fetches detailed info about a specific user.
     */
    async getUserDetail(userId) {
      const res = await api.request(`/admin/users/${userId}`);
      return res.data;
    },

    /**
     * PATCH /api/admin/users/:id/access
     * Updates a user's access level.
     */
    async updateUserAccess(userId, accessLevel, hasPurchased) {
      const res = await api.request(`/admin/users/${userId}/access`, {
        method: 'PATCH',
        body: JSON.stringify({ accessLevel, hasPurchased }),
      });
      return res.data;
    },

    /**
     * GET /api/admin/orders
     * Fetches a paginated list of all orders.
     */
    async getOrders(page = 1, limit = 20, status = '') {
      const params = new URLSearchParams({ page, limit });
      if (status) params.set('status', status);

      const res = await api.request(`/admin/orders?${params.toString()}`);
      return res.data;
    },
  },

  // ═══════════════════════════════════════════════════════════
  // HEALTH CHECK
  // ═══════════════════════════════════════════════════════════

  /**
   * GET /api/health
   * Checks if the backend API is reachable and healthy.
   */
  async healthCheck() {
    try {
      const res = await fetch(`${API_BASE}/health`);
      return await res.json();
    } catch {
      return { success: false, status: 'unreachable' };
    }
  },
};
