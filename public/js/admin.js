// Admin Dashboard Logic
let currentAdminPin = sessionStorage.getItem('adminPin') || '';
let currentTab = 'orders';
let activeStatusFilter = '';
let currentSearchTerm = '';
let autoRefreshInterval = null;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  if (!currentAdminPin) {
    showAuthModal();
  } else {
    initDashboard();
  }
  setupFilterChips();
});

// Toast notification helper
function showToast(message, type = 'info') {
  const container = document.getElementById('adminToastContainer');
  const toast = document.createElement('div');
  toast.style.background = '#121829';
  toast.style.border = `1px solid ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#f59e0b'}`;
  toast.style.color = '#fff';
  toast.style.padding = '12px 20px';
  toast.style.borderRadius = '8px';
  toast.style.marginBottom = '10px';
  toast.style.fontSize = '14px';
  toast.style.boxShadow = '0 8px 25px rgba(0,0,0,0.5)';
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.gap = '8px';
  toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// Authenticated fetch wrapper
async function adminFetch(url, options = {}) {
  options.headers = options.headers || {};
  options.headers['x-admin-pin'] = currentAdminPin;

  const res = await fetch(url, options);
  if (res.status === 401) {
    sessionStorage.removeItem('adminPin');
    currentAdminPin = '';
    showAuthModal();
    throw new Error('Unauthorized');
  }
  return res;
}

// Auth modal management
function showAuthModal() {
  document.getElementById('authModal').style.display = 'flex';
  const pinInput = document.getElementById('adminPinInput');
  pinInput.value = '';
  pinInput.focus();
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const pin = document.getElementById('adminPinInput').value.trim();

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const data = await res.json();

    if (data.success) {
      currentAdminPin = pin;
      sessionStorage.setItem('adminPin', pin);
      document.getElementById('authModal').style.display = 'none';
      showToast('Admin access granted', 'success');
      initDashboard();
    } else {
      showToast('Invalid Security PIN', 'error');
    }
  } catch (err) {
    showToast('Failed to connect to authentication server', 'error');
  }
}

function logoutAdmin() {
  sessionStorage.removeItem('adminPin');
  currentAdminPin = '';
  location.reload();
}

function initDashboard() {
  loadStats();
  loadOrders();
  loadSettings();
  loadServices();

  if (autoRefreshInterval) clearInterval(autoRefreshInterval);
  autoRefreshInterval = setInterval(() => {
    if (currentTab === 'orders') {
      loadStats();
      loadOrders(false); // silent refresh
    }
  }, 8000);
}

// Tab navigation
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

  document.querySelectorAll('.tab-pane').forEach(el => el.style.display = 'none');

  if (tab === 'orders') {
    document.getElementById('tabOrders').style.display = 'block';
    document.getElementById('pageTitle').textContent = 'Orders & Verification Queue';
    document.getElementById('pageSubtitle').textContent = 'Reconcile submitted 12-digit UTR numbers against your bank UPI statement.';
    loadOrders();
    loadStats();
  } else if (tab === 'services') {
    document.getElementById('tabServices').style.display = 'block';
    document.getElementById('pageTitle').textContent = 'Seva Catalog Management';
    document.getElementById('pageSubtitle').textContent = 'Configure offerings, fixed fees, and prasadam descriptions.';
    loadServices();
  } else if (tab === 'settings') {
    document.getElementById('tabSettings').style.display = 'block';
    document.getElementById('pageTitle').textContent = 'Merchant UPI Settings';
    document.getElementById('pageSubtitle').textContent = 'Configure your live Merchant VPA, display name, and expiry timers.';
    loadSettings();
  }
}

function refreshCurrentTab() {
  if (currentTab === 'orders') {
    loadStats();
    loadOrders();
    showToast('Orders refreshed', 'info');
  } else if (currentTab === 'services') {
    loadServices();
  } else if (currentTab === 'settings') {
    loadSettings();
  }
}

// Load statistics
async function loadStats() {
  try {
    const res = await adminFetch('/api/admin/stats');
    const data = await res.json();
    if (data.success && data.stats) {
      const { totalCollected, pendingVerificationCount, verifiedCount, rejectedCount } = data.stats;
      document.getElementById('statTotalCollected').textContent = `₹${Number(totalCollected).toLocaleString('en-IN')}`;
      document.getElementById('statPendingUtr').textContent = pendingVerificationCount;
      document.getElementById('statVerified').textContent = verifiedCount;
      document.getElementById('statRejected').textContent = rejectedCount;

      const badge = document.getElementById('pendingBadge');
      badge.textContent = pendingVerificationCount;
      badge.style.display = pendingVerificationCount > 0 ? 'inline-block' : 'none';
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// Setup order filter chips
function setupFilterChips() {
  const chips = document.querySelectorAll('#statusFilterChips .chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeStatusFilter = chip.getAttribute('data-filter');
      loadOrders();
    });
  });
}

function handleOrderSearch(val) {
  currentSearchTerm = val.trim();
  loadOrders();
}

// Load and render orders table
async function loadOrders(showSpinner = true) {
  const tbody = document.getElementById('ordersTableBody');
  if (showSpinner) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 30px; color: var(--text-dim);">Fetching live transactions...</td></tr>`;
  }

  try {
    let url = `/api/admin/orders?`;
    if (activeStatusFilter) url += `status=${encodeURIComponent(activeStatusFilter)}&`;
    if (currentSearchTerm) url += `search=${encodeURIComponent(currentSearchTerm)}`;

    const res = await adminFetch(url);
    const data = await res.json();

    if (data.success && data.orders) {
      if (data.orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 40px;">No transactions match the selected filter.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.orders.map(order => {
        let utrDisplay = '<span style="color: var(--text-dim);">-</span>';
        if (order.utr) {
          utrDisplay = `
            <div class="utr-badge" onclick="copyText('${order.utr}')" title="Click to copy UTR" style="cursor: pointer;">
              <span>${order.utr}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </div>
          `;
        } else if (order.status === 'PENDING_PAYMENT') {
          utrDisplay = `<span style="font-size: 11px; color: var(--text-dim); font-style: italic;">Awaiting UPI App Payment</span>`;
        }

        let actionHtml = '';
        if (order.status === 'UTR_SUBMITTED') {
          actionHtml = `
            <div class="action-buttons" style="justify-content: flex-end;">
              <button class="btn-action btn-approve" onclick="verifyOrder('${order.orderId}')">
                ✓ Approve
              </button>
              <button class="btn-action btn-reject" onclick="promptRejectOrder('${order.orderId}')">
                ✕ Reject
              </button>
            </div>
          `;
        } else if (order.status === 'VERIFIED') {
          actionHtml = `
            <span style="color: #10b981; font-weight: 700; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;">
              ✓ Verified & Reconciled
            </span>
          `;
        } else if (order.status === 'REJECTED') {
          actionHtml = `
            <span style="color: #ef4444; font-size: 12px;" title="${order.adminNotes || ''}">
              ✕ Rejected (${escapeHtml(order.adminNotes || 'Failed')})
            </span>
          `;
        } else {
          actionHtml = `<span style="color: var(--text-dim); font-size: 12px;">No Action</span>`;
        }

        const dateStr = new Date(order.createdAt).toLocaleDateString('en-IN', {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        return `
          <tr>
            <td>
              <div class="order-id-badge" onclick="copyText('${order.orderId}')" style="cursor: pointer;" title="Click to copy ID">
                ${order.orderId}
              </div>
            </td>
            <td>
              <div style="font-weight: 700; color: #fff;">${escapeHtml(order.serviceTitle)}</div>
              <div style="font-size: 11px; color: var(--text-dim);">${escapeHtml(order.category || 'Seva')}</div>
            </td>
            <td>
              <div style="font-weight: 600; color: #fff;">${escapeHtml(order.customerName)}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(order.customerPhone)}</div>
              ${order.specialNotes ? `<div style="font-size: 11px; color: var(--accent-gold); font-style: italic;">${escapeHtml(order.specialNotes)}</div>` : ''}
            </td>
            <td>
              <span style="font-family: var(--font-heading); font-size: 16px; font-weight: 800; color: #fff;">
                ₹${Number(order.amount).toLocaleString('en-IN')}
              </span>
            </td>
            <td>${utrDisplay}</td>
            <td>
              <span class="status-badge ${order.status}">${order.status.replace('_', ' ')}</span>
            </td>
            <td style="color: var(--text-muted); font-size: 12px;">${dateStr}</td>
            <td style="text-align: right;">${actionHtml}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #ef4444; padding: 30px;">Error loading orders.</td></tr>`;
  }
}

// Approve order
async function verifyOrder(orderId) {
  if (!confirm(`Are you sure you want to verify and confirm payment for ${orderId}?`)) {
    return;
  }

  try {
    const res = await adminFetch(`/api/admin/orders/${orderId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminNotes: 'Verified via UPI Bank Statement' })
    });

    const data = await res.json();
    if (data.success) {
      showToast(`Order ${orderId} marked as verified!`, 'success');
      loadStats();
      loadOrders(false);
    } else {
      showToast(data.message || 'Failed to verify order', 'error');
    }
  } catch (err) {
    showToast('Network error while verifying order', 'error');
  }
}

// Prompt rejection modal
function promptRejectOrder(orderId) {
  document.getElementById('rejectOrderId').value = orderId;
  document.getElementById('rejectReasonInput').value = '';
  document.getElementById('rejectModal').style.display = 'flex';
}

function closeRejectModal() {
  document.getElementById('rejectModal').style.display = 'none';
}

async function confirmRejectOrder() {
  const orderId = document.getElementById('rejectOrderId').value;
  const reason = document.getElementById('rejectReasonInput').value.trim() || 'Payment not matched in bank credits';

  try {
    const res = await adminFetch(`/api/admin/orders/${orderId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });

    const data = await res.json();
    if (data.success) {
      showToast(`Order ${orderId} marked as rejected`, 'info');
      closeRejectModal();
      loadStats();
      loadOrders(false);
    } else {
      showToast(data.message || 'Failed to reject order', 'error');
    }
  } catch (err) {
    showToast('Error rejecting order', 'error');
  }
}

// Settings management
async function loadSettings() {
  try {
    const res = await adminFetch('/api/admin/settings');
    const data = await res.json();
    if (data.success && data.settings) {
      document.getElementById('settingVpa').value = data.settings.merchantVpa || '';
      document.getElementById('settingName').value = data.settings.merchantName || '';
      document.getElementById('settingMcc').value = data.settings.merchantCategoryCode || '8661';
      document.getElementById('settingExpiry').value = data.settings.orderExpiryMinutes || 20;
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

async function handleSaveSettings(e) {
  e.preventDefault();
  const merchantVpa = document.getElementById('settingVpa').value.trim();
  const merchantName = document.getElementById('settingName').value.trim();
  const merchantCategoryCode = document.getElementById('settingMcc').value.trim();
  const orderExpiryMinutes = parseInt(document.getElementById('settingExpiry').value, 10);

  try {
    const res = await adminFetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantVpa,
        merchantName,
        merchantCategoryCode,
        orderExpiryMinutes
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Merchant UPI settings updated successfully!', 'success');
    } else {
      showToast(data.message || 'Failed to update settings', 'error');
    }
  } catch (err) {
    showToast('Error saving settings', 'error');
  }
}

// Seva Catalog management
async function loadServices() {
  const tbody = document.getElementById('servicesTableBody');
  tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-dim); padding: 20px;">Loading services...</td></tr>`;

  try {
    const res = await adminFetch('/api/admin/services');
    const data = await res.json();

    if (data.success && data.services) {
      tbody.innerHTML = data.services.map(s => `
        <tr>
          <td style="font-size: 22px;">${s.icon || '✨'}</td>
          <td>
            <div style="font-weight: 700; color: #fff;">${escapeHtml(s.title)}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(s.description.slice(0, 70))}...</div>
          </td>
          <td><span class="chip" style="font-size: 11px;">${escapeHtml(s.category)}</span></td>
          <td>
            <span style="font-family: var(--font-heading); font-size: 16px; font-weight: 800; color: var(--accent-gold);">
              ₹${Number(s.amount).toLocaleString('en-IN')}
            </span>
          </td>
          <td>${s.badge ? `<span style="font-size: 11px; color: var(--accent-gold);">${s.badge}</span>` : '-'}</td>
          <td>
            <span class="status-badge ${s.active ? 'VERIFIED' : 'REJECTED'}">
              ${s.active ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </td>
          <td style="text-align: right;">
            <button class="btn-action btn-reject" onclick="deleteService('${s.id}')">
              Delete
            </button>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444;">Failed to load services.</td></tr>`;
  }
}

function openNewServiceModal() {
  document.getElementById('serviceForm').reset();
  document.getElementById('editServiceId').value = '';
  document.getElementById('serviceModalTitle').textContent = 'Add New Sacred Seva';
  document.getElementById('serviceModal').style.display = 'flex';
}

function closeServiceModal() {
  document.getElementById('serviceModal').style.display = 'none';
}

async function handleSaveService(e) {
  e.preventDefault();
  const title = document.getElementById('serviceTitle').value.trim();
  const amount = parseFloat(document.getElementById('serviceAmount').value);
  const category = document.getElementById('serviceCategory').value.trim() || 'Special Seva';
  const badge = document.getElementById('serviceBadge').value.trim();
  const icon = document.getElementById('serviceIcon').value.trim() || '🪔';
  const description = document.getElementById('serviceDesc').value.trim();
  const benefitsRaw = document.getElementById('serviceBenefits').value.trim();
  const benefits = benefitsRaw ? benefitsRaw.split(',').map(b => b.trim()) : [];

  try {
    const res = await adminFetch('/api/admin/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        amount,
        category,
        badge,
        icon,
        description,
        benefits
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast('New Seva added to catalog!', 'success');
      closeServiceModal();
      loadServices();
    } else {
      showToast(data.message || 'Failed to add seva', 'error');
    }
  } catch (err) {
    showToast('Error saving seva', 'error');
  }
}

async function deleteService(id) {
  if (!confirm('Are you sure you want to remove this Seva from offerings?')) return;

  try {
    const res = await adminFetch(`/api/admin/services/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Seva removed', 'info');
      loadServices();
    }
  } catch (err) {
    showToast('Failed to delete seva', 'error');
  }
}

// Utility: Copy text
function copyText(str) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(str).then(() => {
      showToast(`Copied to clipboard: ${str}`, 'info');
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
