// Dedicated Checkout Page Logic
let selectedService = null;
let currentOrder = null;
let orderCountdownInterval = null;
let statusPollInterval = null;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const serviceId = urlParams.get('id') || urlParams.get('service');

  await loadService(serviceId);
});

// Toast notification helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Fetch Services & find requested offering
async function loadService(serviceId) {
  const loading = document.getElementById('checkoutLoading');
  const content = document.getElementById('checkoutContent');

  try {
    const res = await fetch('/api/services');
    const data = await res.json();

    if (data.success && data.services && data.services.length > 0) {
      selectedService = serviceId
        ? data.services.find(s => s.id === serviceId)
        : data.services[0];

      if (!selectedService) {
        selectedService = data.services[0];
      }

      loading.style.display = 'none';
      content.style.display = 'block';
      renderDevoteeStep();
    } else {
      loading.innerHTML = `
        <div style="color: #ef4444; margin-bottom: 16px;">Failed to load seva offerings.</div>
        <a href="/" class="btn-book" style="display: inline-block;">Return to Home</a>
      `;
    }
  } catch (err) {
    console.error('Error fetching service:', err);
    loading.innerHTML = `
      <div style="color: #ef4444; margin-bottom: 16px;">Could not connect to server.</div>
      <a href="/" class="btn-book" style="display: inline-block;">Return to Home</a>
    `;
  }
}

// Step 1: Render Devotee Details Form
function renderDevoteeStep() {
  updatePills(1);
  const content = document.getElementById('checkoutContent');

  content.innerHTML = `
    <div class="service-banner">
      <div>
        <div class="category">${escapeHtml(selectedService.category || 'Sacred Seva')}</div>
        <div class="title">${escapeHtml(selectedService.title)}</div>
      </div>
      <div>
        <div style="font-size: 11px; color: var(--text-dim); text-transform: uppercase;">Fixed Fee</div>
        <div class="price">₹${Number(selectedService.amount).toLocaleString('en-IN')}</div>
      </div>
    </div>

    <form id="devoteeForm" onsubmit="handleDevoteeSubmit(event)">
      <div class="form-group">
        <label>Devotee / Donor Full Name <span class="required">*</span></label>
        <input type="text" id="custName" class="form-control" placeholder="e.g. Ramesh Sharma" required maxlength="80" autofocus>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>WhatsApp / Mobile Number <span class="required">*</span></label>
          <input type="tel" id="custPhone" class="form-control" placeholder="10-digit mobile number" required pattern="[0-9]{10}" maxlength="10">
        </div>
        <div class="form-group">
          <label>Email Address (For e-Receipt)</label>
          <input type="email" id="custEmail" class="form-control" placeholder="devotee@example.com" maxlength="100">
        </div>
      </div>

      <div class="form-group">
        <label>Gotram / Nakshatram / Special Prayers</label>
        <input type="text" id="custNotes" class="form-control" placeholder="e.g., Koushika Gotra, Bharani Star (optional)" maxlength="180">
      </div>

      <div style="display: flex; gap: 12px; margin-top: 24px;">
        <a href="/" class="btn-copy-vpa" style="flex: 1; padding: 14px; text-align: center; text-decoration: none;">&larr; Cancel</a>
        <button type="submit" class="btn-book" style="flex: 2; justify-content: center;" id="btnProceedToPay">
          <span>Proceed to UPI Payment</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </div>
    </form>
  `;
}

// Handle Order Creation via Backend
async function handleDevoteeSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('btnProceedToPay');
  btn.disabled = true;
  btn.innerHTML = `<span>Securing Order...</span>`;

  const customerName = document.getElementById('custName').value.trim();
  const customerPhone = document.getElementById('custPhone').value.trim();
  const customerEmail = document.getElementById('custEmail').value.trim();
  const specialNotes = document.getElementById('custNotes').value.trim();

  try {
    const res = await fetch('/api/orders/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: selectedService.id,
        customerName,
        customerPhone,
        customerEmail,
        specialNotes
      })
    });

    const data = await res.json();
    if (data.success && data.order) {
      currentOrder = data.order;
      renderPaymentStep(data.order);
    } else {
      showToast(data.message || 'Could not initiate payment order', 'error');
      btn.disabled = false;
      btn.innerHTML = `<span>Proceed to UPI Payment &rarr;</span>`;
    }
  } catch (err) {
    console.error('Order creation failed:', err);
    showToast('Network error while initiating payment.', 'error');
    btn.disabled = false;
    btn.innerHTML = `<span>Proceed to UPI Payment &rarr;</span>`;
  }
}

// Step 2: Render Payment Execution Screen
function renderPaymentStep(order) {
  updatePills(2);
  const content = document.getElementById('checkoutContent');

  const isAndroid = /Android/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  const primaryUpiUrl = isAndroid ? (order.upiLinks.androidIntent || order.upiLinks.generic) : order.upiLinks.generic;
  const gpayUrl = isAndroid ? (order.upiLinks.gpay || order.upiLinks.generic) : order.upiLinks.generic;
  const phonepeUrl = isAndroid ? (order.upiLinks.phonepe || order.upiLinks.generic) : order.upiLinks.generic;
  const paytmUrl = isAndroid ? (order.upiLinks.paytm || order.upiLinks.generic) : order.upiLinks.generic;
  const genericUrl = order.upiLinks.generic;

  content.innerHTML = `
    <!-- Top Order Summary & Timer -->
    <div class="order-summary-box">
      <div>
        <div class="summary-order-id">REF: ${order.orderId}</div>
        <div class="summary-title">${escapeHtml(order.serviceTitle)}</div>
        <div style="font-size: 13px; color: var(--text-muted);">Devotee: ${escapeHtml(order.customerName)} (${escapeHtml(order.customerPhone)})</div>
      </div>
      <div>
        <div class="summary-amount">₹${Number(order.amount).toLocaleString('en-IN')}</div>
        <div id="countdownTimer" class="timer-pill">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <span id="timerText">19:59 remaining</span>
        </div>
      </div>
    </div>

    <!-- Dynamic Universal QR Code Display -->
    <div class="qr-container" id="qrCodeContainer">
      <img src="${order.qrCodeDataUrl}" alt="UPI Dynamic QR Code" class="qr-image" />
      <div class="qr-caption">Scan with Any UPI App (GPay / PhonePe / Paytm / BHIM)</div>
    </div>

    <!-- Mobile Quick Intent App Launchers -->
    <div class="mobile-pay-section">
      <!-- 1-Tap Universal Launcher Button -->
      <a href="${primaryUpiUrl}" class="btn-fast-pay" onclick="handleUpiLinkClick(event, this.href)">
        <div style="font-size: 22px;">⚡</div>
        <div style="text-align: left; flex: 1;">
          <div style="font-size: 15px; font-weight: 700; color: #fff;">Pay ₹${Number(order.amount).toLocaleString('en-IN')} via UPI App</div>
          <div style="font-size: 12px; color: var(--accent-gold);">Tap to open Google Pay, PhonePe, Paytm, or BHIM directly</div>
        </div>
        <div style="font-size: 18px; color: var(--accent-gold);">&rarr;</div>
      </a>

      <div class="upi-app-buttons-label">
        <span>Or Choose Specific UPI App</span>
        <div class="desktop-hint-badge">
          <span>💡</span> Desktop users: Scan QR code above
        </div>
      </div>
      <div class="upi-app-grid">
        <a href="${gpayUrl}" class="btn-upi-app" onclick="handleUpiLinkClick(event, this.href)">
          <div class="app-icon gpay">G</div>
          <span>Google Pay</span>
        </a>
        <a href="${phonepeUrl}" class="btn-upi-app" onclick="handleUpiLinkClick(event, this.href)">
          <div class="app-icon phonepe">पे</div>
          <span>PhonePe</span>
        </a>
        <a href="${paytmUrl}" class="btn-upi-app" onclick="handleUpiLinkClick(event, this.href)">
          <div class="app-icon paytm">P</div>
          <span>Paytm</span>
        </a>
        <a href="${genericUrl}" class="btn-upi-app" onclick="handleUpiLinkClick(event, this.href)">
          <div class="app-icon anyupi">UPI</div>
          <span>Any UPI</span>
        </a>
      </div>
    </div>

    <!-- Copy Merchant VPA & Link Section -->
    <div class="vpa-copy-box">
      <div class="vpa-info">
        <span class="vpa-label">Trust UPI ID</span>
        <span class="vpa-val" id="merchantVpaText">${order.merchantVpa}</span>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn-copy-vpa" onclick="copyMerchantVpa('${order.merchantVpa}')" title="Copy UPI VPA">
          📋 Copy UPI ID
        </button>
        <button class="btn-copy-vpa" onclick="copyUpiPaymentLink('${order.upiLinks.generic}')" title="Copy Direct UPI URI Link">
          🔗 Copy Link
        </button>
      </div>
    </div>

    <!-- UTR Submission Card -->
    <div class="utr-submission-card">
      <div class="utr-header">
        <h4>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Enter 12-Digit UPI Ref / UTR Number
        </h4>
      </div>
      <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">
        After completing the payment in GPay / PhonePe / Paytm, copy the 12-digit transaction UTR number and paste it below.
      </p>

      <div class="utr-input-wrapper">
        <input 
          type="text" 
          id="utrInput" 
          class="utr-input" 
          placeholder="e.g. 4291 8291 0291" 
          maxlength="14"
          oninput="handleUtrInput(this)"
          autocomplete="off"
        />
        <span class="utr-counter" id="utrCounter">0 / 12</span>
      </div>

      <button id="btnSubmitUtr" class="btn-submit-utr" disabled onclick="submitUtr()">
        Verify & Confirm Payment
      </button>
    </div>
  `;

  startOrderCountdown(order.expiresAt);
}

// Smart UPI App Intent Handler
function handleUpiLinkClick(event, href) {
  const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent) || window.innerWidth <= 768;

  if (!isMobile) {
    if (event) event.preventDefault();
    showToast('📱 UPI apps only open on mobile phones. On your computer, please scan the QR code above with your phone camera!', 'info');

    const qrContainer = document.getElementById('qrCodeContainer');
    if (qrContainer) {
      qrContainer.classList.remove('qr-highlight-pulse');
      void qrContainer.offsetWidth;
      qrContainer.classList.add('qr-highlight-pulse');
      qrContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTimeout(() => {
        qrContainer.classList.remove('qr-highlight-pulse');
      }, 3000);
    }
    return;
  }

  setTimeout(() => {
    showToast('Launching UPI app... After completing payment, enter your 12-digit UTR below.', 'info');
  }, 1000);
}

// Format UTR input as user types
function handleUtrInput(input) {
  let val = input.value.replace(/\D/g, '').slice(0, 12);
  const counter = document.getElementById('utrCounter');
  const btn = document.getElementById('btnSubmitUtr');

  counter.textContent = `${val.length} / 12`;

  let formatted = '';
  for (let i = 0; i < val.length; i++) {
    if (i > 0 && i % 4 === 0) formatted += ' ';
    formatted += val[i];
  }
  input.value = formatted;

  if (val.length === 12) {
    btn.disabled = false;
    counter.style.color = '#10b981';
  } else {
    btn.disabled = true;
    counter.style.color = 'var(--text-dim)';
  }
}

// Submit UTR
async function submitUtr() {
  const input = document.getElementById('utrInput');
  const btn = document.getElementById('btnSubmitUtr');
  const cleanUtr = input.value.replace(/\D/g, '');

  if (cleanUtr.length !== 12) {
    showToast('Please enter complete 12-digit UTR number', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Submitting Reference...';

  try {
    const res = await fetch(`/api/orders/${currentOrder.orderId}/submit-utr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ utr: cleanUtr })
    });

    const data = await res.json();
    if (data.success) {
      showToast('UTR submitted successfully! Checking verification...', 'success');
      currentOrder.utr = cleanUtr;
      renderPendingVerificationStep(currentOrder);
      startStatusPolling(currentOrder.orderId);
    } else {
      showToast(data.message || 'Failed to submit UTR', 'error');
      btn.disabled = false;
      btn.textContent = 'Verify & Confirm Payment';
    }
  } catch (err) {
    console.error('Error submitting UTR:', err);
    showToast('Network error while verifying UTR.', 'error');
    btn.disabled = false;
    btn.textContent = 'Verify & Confirm Payment';
  }
}

// Render Pending Verification Screen
function renderPendingVerificationStep(order) {
  const content = document.getElementById('checkoutContent');

  content.innerHTML = `
    <div class="status-state-box">
      <div class="status-icon-circle pending">⏳</div>
      <h4>Payment Reference Submitted</h4>
      <p>
        Your 12-digit UPI UTR (<strong>${order.utr}</strong>) for <strong>₹${Number(order.amount).toLocaleString('en-IN')}</strong> is recorded and awaiting verification.
      </p>

      <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px; margin-bottom: 20px; font-size: 13px; color: var(--text-muted); display: inline-flex; align-items: center; gap: 8px;">
        <div style="width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; animation: pulseGold 1.5s infinite;"></div>
        Auto-checking status every few seconds...
      </div>

      <div style="display: flex; gap: 12px; justify-content: center;">
        <button class="btn-copy-vpa" onclick="checkOrderStatusManually('${order.orderId}')">
          🔄 Refresh Status
        </button>
        <a href="/" class="btn-copy-vpa" style="text-decoration: none;">
          Return to Offerings
        </a>
      </div>
    </div>
  `;
}

// Step 3: Render Verified Receipt Screen
function renderVerifiedStep(order) {
  updatePills(3);
  clearInterval(statusPollInterval);
  clearInterval(orderCountdownInterval);

  const content = document.getElementById('checkoutContent');

  content.innerHTML = `
    <div class="status-state-box">
      <div class="status-icon-circle verified">✓</div>
      <h4 style="color: #10b981;">Offering Confirmed & Verified!</h4>
      <p>
        Heartfelt gratitude! Your sacred seva payment of <strong>₹${Number(order.amount).toLocaleString('en-IN')}</strong> has been confirmed.
      </p>

      <div class="receipt-card" id="printableReceipt">
        <div style="text-align: center; margin-bottom: 14px; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 10px;">
          <div style="font-weight: 700; color: #fff; font-size: 16px;">Sri Seva Charitable Trust</div>
          <div style="font-size: 12px; color: var(--accent-gold);">Official Sacred Offering Receipt</div>
        </div>

        <div class="receipt-row">
          <span class="label">Receipt / Order ID</span>
          <span class="value" style="font-family: monospace;">${order.orderId}</span>
        </div>
        <div class="receipt-row">
          <span class="label">Seva Name</span>
          <span class="value">${escapeHtml(order.serviceTitle)}</span>
        </div>
        <div class="receipt-row">
          <span class="label">Devotee Name</span>
          <span class="value">${escapeHtml(order.customerName)}</span>
        </div>
        <div class="receipt-row">
          <span class="label">Mobile</span>
          <span class="value">${escapeHtml(order.customerPhone)}</span>
        </div>
        ${order.specialNotes ? `
          <div class="receipt-row">
            <span class="label">Gotram / Sankalpam</span>
            <span class="value">${escapeHtml(order.specialNotes)}</span>
          </div>
        ` : ''}
        <div class="receipt-row">
          <span class="label">UPI UTR Ref</span>
          <span class="value" style="color: #10b981; font-family: monospace;">${order.utr}</span>
        </div>
        <div class="receipt-row">
          <span class="label">Dakshina Amount</span>
          <span class="value" style="font-size: 16px; color: var(--accent-gold);">₹${Number(order.amount).toLocaleString('en-IN')}</span>
        </div>
        <div class="receipt-row">
          <span class="label">Verified On</span>
          <span class="value">${new Date(order.verifiedAt || Date.now()).toLocaleString('en-IN')}</span>
        </div>
      </div>

      <div style="display: flex; gap: 12px; justify-content: center; margin-top: 20px;">
        <button class="btn-book" onclick="window.print()">
          🖨️ Print / Save Receipt
        </button>
        <a href="/" class="btn-copy-vpa" style="text-decoration: none; padding: 12px 20px;">
          Done
        </a>
      </div>
    </div>
  `;
}

// Status Polling
function startStatusPolling(orderId) {
  if (statusPollInterval) clearInterval(statusPollInterval);

  statusPollInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`);
      const data = await res.json();
      if (data.success && data.order) {
        if (data.order.status === 'VERIFIED') {
          renderVerifiedStep(data.order);
        } else if (data.order.status === 'REJECTED') {
          showToast('Payment verification was rejected by admin.', 'error');
        }
      }
    } catch (err) {
      console.warn('Status poll failed:', err);
    }
  }, 3500);
}

async function checkOrderStatusManually(orderId) {
  try {
    const res = await fetch(`/api/orders/${orderId}/status`);
    const data = await res.json();
    if (data.success && data.order) {
      if (data.order.status === 'VERIFIED') {
        renderVerifiedStep(data.order);
      } else {
        showToast('Payment is still in verification queue.', 'info');
      }
    }
  } catch (err) {
    showToast('Failed to check status', 'error');
  }
}

// Countdown timer
function startOrderCountdown(expiresAt) {
  if (orderCountdownInterval) clearInterval(orderCountdownInterval);

  function update() {
    const now = new Date().getTime();
    const expiry = new Date(expiresAt).getTime();
    const diff = Math.max(0, expiry - now);

    const minutes = Math.floor(diff / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const timerText = document.getElementById('timerText');
    if (timerText) {
      timerText.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} remaining`;
    }

    if (diff <= 0) {
      clearInterval(orderCountdownInterval);
      if (timerText) {
        timerText.textContent = 'Session Expired';
        showToast('Payment session expired. Please start over.', 'error');
      }
    }
  }

  update();
  orderCountdownInterval = setInterval(update, 1000);
}

// Copy helpers
function copyMerchantVpa(vpa) {
  copyToClipboard(vpa, `Copied UPI ID: ${vpa}`);
}

function copyUpiPaymentLink(link) {
  copyToClipboard(link, 'UPI Payment Link copied to clipboard!');
}

function copyToClipboard(text, successMsg) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg, 'success');
    }).catch(() => fallbackCopy(text, successMsg));
  } else {
    fallbackCopy(text, successMsg);
  }
}

function fallbackCopy(text, successMsg) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
  showToast(successMsg, 'success');
}

// Update Step Indicator Pills
function updatePills(activeStep) {
  const pill1 = document.getElementById('pillStep1');
  const pill2 = document.getElementById('pillStep2');
  const pill3 = document.getElementById('pillStep3');

  if (!pill1 || !pill2 || !pill3) return;

  pill1.classList.toggle('active', activeStep === 1);
  pill2.classList.toggle('active', activeStep === 2);
  pill3.classList.toggle('active', activeStep === 3);
}
