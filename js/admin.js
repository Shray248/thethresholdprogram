// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — ADMIN PORTAL
// Bootstraps data for the admin.html file
// ═══════════════════════════════════════════════════════════

// Global state
let currentPage = 1;
let currentSearch = '';
let targetUserId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const loadingState = document.getElementById('state-loading');
  const errorState = document.getElementById('state-error');
  const dashboardState = document.getElementById('state-dashboard');
  
  try {
    // 1. Authenticate and check role
    const user = await api.auth.getMe();
    
    if (user.role !== 'ADMIN') {
      throw new Error('Insufficient clearance.');
    }
    
    document.getElementById('admin-greeting').textContent = `SysAdmin: ${user.email}`;

    // 2. Fetch stats
    await fetchStats();

    // 3. Fetch users
    await fetchUsers(1);

    // 4. Reveal dashboard
    loadingState.classList.add('hidden');
    dashboardState.classList.remove('hidden');
    // slight delay for transition
    setTimeout(() => dashboardState.classList.remove('opacity-0'), 50);

  } catch (err) {
    loadingState.classList.add('hidden');
    errorState.classList.remove('hidden');
    if(err.message === 'Insufficient clearance.') {
      document.getElementById('error-message').textContent = 'You do not have the required clearance to view this sector.';
    }
  }

  // Hook up search ENTER key
  document.getElementById('user-search').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') fetchUsers();
  });
});

function logout() {
  api.clearSession();
  window.location.href = '/';
}

// ─── Fetch Data ─────────────────────────────────────

async function fetchStats() {
  try {
    const stats = await api.admin.getStats();
    const ov = stats.overview;

    document.getElementById('stat-total-users').textContent = ov.totalUsers;
    document.getElementById('stat-purchased-users').textContent = ov.purchasedUsers;
    document.getElementById('stat-conversion').textContent = ov.conversionRate;

    // Calculate sum of USD revenue as an example metric 
    // Data is stored in cents, convert to dollars
    const usdObj = stats.revenue.byCurrency['usd'];
    const usdRev = usdObj ? (usdObj.amount / 100).toFixed(2) : '0.00';
    document.getElementById('stat-revenue').textContent = '$' + parseFloat(usdRev).toLocaleString();

    // Render Recent Orders
    const list = document.getElementById('recent-orders-list');
    list.innerHTML = '';
    
    if (stats.recentOrders.length === 0) {
      list.innerHTML = '<p class="text-xs text-silver/50 font-mono">No recent transactions.</p>';
    } else {
      stats.recentOrders.forEach(o => {
        const amt = (o.amount / 100).toFixed(2);
        const curr = o.currency.toUpperCase();
        const date = new Date(o.createdAt).toLocaleDateString();
        const statColor = o.status === 'COMPLETED' ? 'text-green-500' : (o.status === 'PENDING' ? 'text-yellow-500' : 'text-accent');
        
        list.innerHTML += `
          <div class="flex items-center justify-between border-b border-white/[0.02] pb-3 last:border-0 last:pb-0">
            <div>
              <p class="text-sm text-bone">${o.email}</p>
              <p class="text-xs font-mono text-silver/60 uppercase mt-0.5">${o.productType} · ${date}</p>
            </div>
            <div class="text-right">
              <p class="text-sm font-mono text-bone">${amt} ${curr}</p>
              <p class="text-[10px] font-mono uppercase mt-0.5 ${statColor}">${o.status}</p>
            </div>
          </div>
        `;
      });
    }

  } catch (err) {
    console.error('Failed to load stats', err);
  }
}

async function fetchUsers(page = 1) {
  try {
    const searchVal = document.getElementById('user-search').value;
    const res = await api.admin.getUsers(page, 20, searchVal);
    
    currentPage = page;
    renderUserTable(res.users);
    updatePaginationControls(res.pagination);

  } catch (err) {
    console.error('Failed to load users', err);
  }
}

function renderUserTable(users) {
  const tbody = document.getElementById('users-table-body');
  tbody.innerHTML = '';

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-silver/40 font-mono text-xs">No users found.</td></tr>`;
    return;
  }

  users.forEach(u => {
    const isCustomer = u.hasPurchased;
    const date = new Date(u.createdAt).toLocaleDateString();
    
    tbody.innerHTML += `
      <tr class="hover:bg-white/[0.02] transition-colors group">
        <td class="px-6 py-4">
          <p class="text-sm text-bone font-medium">${u.firstName} ${u.lastName}</p>
          <p class="text-xs text-silver mt-0.5">${u.email}</p>
        </td>
        <td class="px-6 py-4">
          <span class="px-2 py-1 bg-charcoal border border-white/10 text-[10px] font-mono text-${isCustomer ? 'green-500' : 'silver/60'} rounded-sm uppercase tracking-widest">${u.accessLevel}</span>
        </td>
        <td class="px-6 py-4 text-xs font-mono text-silver/60">
          ${date}
        </td>
        <td class="px-6 py-4 text-right">
          <button onclick="openAccessModal('${u.id}', '${u.email}', '${u.accessLevel}', ${u.hasPurchased})" class="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-mono text-accent hover:text-white border border-accent/30 hover:border-accent px-3 py-1.5 rounded-sm uppercase tracking-widest">
            Modify
          </button>
        </td>
      </tr>
    `;
  });
}

function updatePaginationControls(nav) {
  const info = document.getElementById('user-pagination-info');
  const btnPrev = document.getElementById('btn-prev-users');
  const btnNext = document.getElementById('btn-next-users');

  const start = ((nav.page - 1) * nav.limit) + 1;
  const end = Math.min(start + nav.limit - 1, nav.total);
  
  if (nav.total === 0) {
    info.textContent = `Showing 0 results`;
  } else {
    info.textContent = `Showing ${start}-${end} of ${nav.total}`;
  }

  btnPrev.disabled = !nav.hasPrev;
  btnNext.disabled = !nav.hasNext;
  
  btnPrev.onclick = () => fetchUsers(nav.page - 1);
  btnNext.onclick = () => fetchUsers(nav.page + 1);
}

// ─── Modal Management ────────────────────────────────

function openAccessModal(id, email, accessLevel, hasPurchased) {
  targetUserId = id;
  document.getElementById('modal-user-email').textContent = email;
  document.getElementById('modal-access-level').value = accessLevel;
  document.getElementById('modal-has-purchased').checked = hasPurchased;
  
  const modal = document.getElementById('access-modal');
  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    document.getElementById('access-modal-content').classList.remove('scale-95');
  }, 10);
}

function closeAccessModal() {
  const modal = document.getElementById('access-modal');
  modal.classList.add('opacity-0');
  document.getElementById('access-modal-content').classList.add('scale-95');
  setTimeout(() => modal.classList.add('hidden'), 300);
  targetUserId = null;
}

async function saveAccessOverride() {
  if (!targetUserId) return;
  
  const newLevel = document.getElementById('modal-access-level').value;
  const newPurchased = document.getElementById('modal-has-purchased').checked;
  
  try {
    await api.admin.updateUserAccess(targetUserId, newLevel, newPurchased);
    closeAccessModal();
    // Refresh lists
    await fetchStats();
    await fetchUsers(currentPage);
  } catch (err) {
    alert(err.message || 'Error updating access');
  }
}
