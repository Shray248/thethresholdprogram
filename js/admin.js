// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — ADMIN DASHBOARD JS
// Order-based dashboard — revenue stats, order management.
// Uses the admin API endpoints for data.
// ═══════════════════════════════════════════════════════════

let currentPage = 1;
let currentPagination = null;

// ═══════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  const loadingEl = document.getElementById('state-loading');
  const loginEl = document.getElementById('state-login');
  const dashboardEl = document.getElementById('state-dashboard');

  // Check if we have a stored token
  const token = localStorage.getItem('admin_token');

  if (!token) {
    // Show login form
    loadingEl.classList.add('hidden');
    loginEl.classList.remove('hidden');
    return;
  }

  // Try to authenticate with stored token
  try {
    const admin = await api.auth.getMe();
    showDashboard(admin);
  } catch (err) {
    // Token invalid — show login
    localStorage.removeItem('admin_token');
    loadingEl.classList.add('hidden');
    loginEl.classList.remove('hidden');
  }

  // Hook up search on Enter key
  document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') fetchOrders(1);
  });
});

// ═══════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════

async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  errorEl.classList.remove('visible');
  btn.disabled = true;
  btn.textContent = 'Signing in...';

  try {
    const data = await api.auth.login(email, password);
    showDashboard(data.admin);
  } catch (err) {
    errorEl.textContent = err.message || 'Invalid credentials.';
    errorEl.classList.add('visible');
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

function handleLogout() {
  api.auth.logout();
  window.location.reload();
}

function showDashboard(admin) {
  document.getElementById('state-loading').classList.add('hidden');
  document.getElementById('state-login').classList.add('hidden');
  document.getElementById('state-dashboard').classList.remove('hidden');
  document.getElementById('admin-email').textContent = admin.email;
  document.getElementById('logout-btn').style.display = '';

  // Load data
  fetchStats();
  fetchOrders(1);
}

// ═══════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════

async function fetchStats() {
  try {
    const stats = await api.admin.getStats();
    const ov = stats.overview;

    document.getElementById('stat-total').textContent = ov.totalOrders;
    document.getElementById('stat-completed').textContent = ov.completedOrders;
    document.getElementById('stat-revenue').textContent = ov.totalRevenueFormatted;

    // Pending count from byStatus
    const pending = stats.orders.byStatus?.PENDING || 0;
    document.getElementById('stat-pending').textContent = pending;
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// ═══════════════════════════════════════════════════════════
// ORDERS TABLE
// ═══════════════════════════════════════════════════════════

async function fetchOrders(page = 1) {
  currentPage = page;

  const search = document.getElementById('search-input').value.trim();
  const status = document.getElementById('filter-status').value;

  try {
    const data = await api.admin.getOrders(page, 20, search, status);
    renderOrders(data.orders);
    updatePagination(data.pagination);
  } catch (err) {
    console.error('Failed to load orders:', err);
    document.getElementById('orders-tbody').innerHTML =
      '<tr class="empty-row"><td colspan="5">Failed to load orders.</td></tr>';
  }
}

function renderOrders(orders) {
  const tbody = document.getElementById('orders-tbody');

  if (!orders || orders.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No orders found.</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(order => {
    const displayName = order.buyerName || 'Unknown';
    const displayEmail = order.buyerEmail || '—';
    const date = new Date(order.createdAt).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });

    const statusClass = `badge-${order.status.toLowerCase()}`;

    return `
      <tr>
        <td>
          <div class="buyer-name">${escapeHtml(displayName)}</div>
          <div class="buyer-meta">${escapeHtml(displayEmail)}</div>
        </td>
        <td class="amount-cell">${order.amountFormatted}</td>
        <td><span class="badge ${statusClass}">${order.status}</span></td>
        <td class="date-cell">${date}</td>
        <td style="text-align:right;">
          <button class="detail-btn" onclick="openOrderDetail('${order.id}')">View</button>
        </td>
      </tr>
    `;
  }).join('');
}

function updatePagination(pagination) {
  currentPagination = pagination;

  const info = document.getElementById('pagination-info');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');

  if (pagination.total === 0) {
    info.textContent = 'No results';
  } else {
    const start = (pagination.page - 1) * pagination.limit + 1;
    const end = Math.min(start + pagination.limit - 1, pagination.total);
    info.textContent = `${start}–${end} of ${pagination.total}`;
  }

  btnPrev.disabled = !pagination.hasPrev;
  btnNext.disabled = !pagination.hasNext;
}

function prevPage() {
  if (currentPagination?.hasPrev) fetchOrders(currentPage - 1);
}

function nextPage() {
  if (currentPagination?.hasNext) fetchOrders(currentPage + 1);
}

// ═══════════════════════════════════════════════════════════
// ORDER DETAIL MODAL
// ═══════════════════════════════════════════════════════════

let currentOrderId = null;

async function openOrderDetail(id) {
  currentOrderId = id;

  const modal = document.getElementById('order-modal');
  const body = document.getElementById('modal-body');

  body.innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner-lg" style="margin:0 auto 12px;"></div><p class="state-text">Loading...</p></div>';
  modal.classList.add('active');

  try {
    const order = await api.admin.getOrderDetail(id);
    renderOrderDetail(order);
  } catch (err) {
    body.innerHTML = `<p style="color:#f87171;text-align:center;padding:40px;">${err.message || 'Failed to load order.'}</p>`;
  }
}

function renderOrderDetail(order) {
  const body = document.getElementById('modal-body');

  const situationMap = {
    'stuck_in_loop': 'Stuck in the same patterns',
    'lack_clarity': 'Lacks clarity on blockers',
    'surface_changes': 'Surface-level changes haven\'t worked',
    'growth_plateau': 'Hit a growth plateau',
    'inner_conflict': 'Inner conflict / self-sabotage',
    'ready_for_change': 'Ready for deep change',
    'other': 'Other',
  };

  const date = new Date(order.createdAt).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  body.innerHTML = `
    <div class="modal-field">
      <p class="modal-field-label">Buyer Name</p>
      <p class="modal-field-value">${escapeHtml(order.buyerName || '—')}</p>
    </div>
    <div class="modal-field">
      <p class="modal-field-label">Email</p>
      <p class="modal-field-value">${escapeHtml(order.buyerEmail || '—')}</p>
    </div>
    <div class="modal-field">
      <p class="modal-field-label">Phone</p>
      <p class="modal-field-value">${escapeHtml(order.buyerPhone || '—')}</p>
    </div>
    ${order.buyerInstagram ? `
    <div class="modal-field">
      <p class="modal-field-label">Instagram</p>
      <p class="modal-field-value">@${escapeHtml(order.buyerInstagram.replace('@', ''))}</p>
    </div>
    ` : ''}

    <div class="modal-divider"></div>

    ${order.currentSituation ? `
    <div class="modal-field">
      <p class="modal-field-label">Current Situation</p>
      <p class="modal-field-value">${escapeHtml(situationMap[order.currentSituation] || order.currentSituation)}</p>
    </div>
    ` : ''}
    ${order.investmentCapacity ? `
    <div class="modal-field">
      <p class="modal-field-label">Investment Readiness</p>
      <p class="modal-field-value">${escapeHtml(order.investmentCapacity)}</p>
    </div>
    ` : ''}

    <div class="modal-divider"></div>

    <div class="modal-field">
      <p class="modal-field-label">Amount</p>
      <p class="modal-field-value">${order.amountFormatted}</p>
    </div>
    <div class="modal-field">
      <p class="modal-field-label">Status</p>
      <p class="modal-field-value"><span class="badge badge-${order.status.toLowerCase()}">${order.status}</span></p>
    </div>
    <div class="modal-field">
      <p class="modal-field-label">Date</p>
      <p class="modal-field-value">${date}</p>
    </div>

    ${order.razorpayOrderId ? `
    <div class="modal-field">
      <p class="modal-field-label">Razorpay Order ID</p>
      <p class="modal-field-value mono">${escapeHtml(order.razorpayOrderId)}</p>
    </div>
    ` : ''}
    ${order.razorpayPaymentId ? `
    <div class="modal-field">
      <p class="modal-field-label">Razorpay Payment ID</p>
      <p class="modal-field-value mono">${escapeHtml(order.razorpayPaymentId)}</p>
    </div>
    ` : ''}
    ${order.failureReason ? `
    <div class="modal-field">
      <p class="modal-field-label">Failure Reason</p>
      <p class="modal-field-value" style="color:#f87171;">${escapeHtml(order.failureReason)}</p>
    </div>
    ` : ''}

    <div class="modal-divider"></div>

    <div class="modal-status-group">
      <p class="modal-field-label" style="margin-bottom:8px;">Update Status</p>
      <select class="modal-status-select" id="modal-status-select">
        <option value="PENDING" ${order.status === 'PENDING' ? 'selected' : ''}>Pending</option>
        <option value="COMPLETED" ${order.status === 'COMPLETED' ? 'selected' : ''}>Completed</option>
        <option value="FAILED" ${order.status === 'FAILED' ? 'selected' : ''}>Failed</option>
        <option value="REFUNDED" ${order.status === 'REFUNDED' ? 'selected' : ''}>Refunded</option>
      </select>
      <button class="modal-save-btn" id="modal-save-btn" onclick="updateOrderStatus()">Update Status</button>
    </div>
  `;
}

async function updateOrderStatus() {
  if (!currentOrderId) return;

  const newStatus = document.getElementById('modal-status-select').value;
  const btn = document.getElementById('modal-save-btn');

  btn.disabled = true;
  btn.textContent = 'Updating...';

  try {
    await api.admin.updateOrderStatus(currentOrderId, newStatus);
    closeModal();
    // Refresh
    await Promise.all([fetchStats(), fetchOrders(currentPage)]);
  } catch (err) {
    alert(err.message || 'Failed to update status.');
    btn.disabled = false;
    btn.textContent = 'Update Status';
  }
}

function closeModal() {
  document.getElementById('order-modal').classList.remove('active');
  currentOrderId = null;
}

// ═══════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
