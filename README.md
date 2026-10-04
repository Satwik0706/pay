# 🛡️ Secure Direct UPI Payment Panel (Option B)

A production-grade, tamper-proof direct UPI payment panel built with **Node.js, Express, and Vanilla JS/CSS**.

Designed for **Devotee Sevas, Religious Trusts, Charities, and Direct Merchant Services** where prices/dakshina fees are stored strictly on the backend, generating dynamic UPI deep links and QR codes, with 12-digit NPCI UTR submission and Admin reconciliation.

---

## 🌟 Key Features

1. **Strict Server-Side Price Locking (Zero Client Tampering)**:
   - Seva catalog and dakshina fees are maintained exclusively on the server (`data/services.json`).
   - Any client-submitted amount is ignored; the backend sets the exact fee and signs each order with an **HMAC SHA-256 cryptographic signature**.

2. **Universal & App-Specific UPI Deep Links**:
   - Generates standard NPCI UPI URI: `upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...&tr=...`
   - Direct 1-tap mobile launcher intents:
     - **Google Pay**: `tez://upi/pay?...`
     - **PhonePe**: `phonepe://pay?...`
     - **Paytm**: `paytmmp://pay?...`
     - **Any UPI / BHIM**: `upi://pay?...`

3. **Dynamic Universal QR Code**:
   - Generates an in-memory base64 QR code with exact amount and transaction reference ID for scanning on desktop or tablets.

4. **12-Digit UTR Verification & Replay Protection**:
   - Validates that the submitted UTR is strictly 12 numeric digits according to NPCI specifications.
   - **Replay / Double-Spending Prevention**: A submitted UTR cannot be submitted again for any other order.
   - Session countdown timer (configurable, default 20 minutes) prevents utilization of expired orders.

5. **Merchant Admin Dashboard (`/admin`)**:
   - Real-time KPI statistics: Total Collected (₹), Action Required (Pending UTRs), Verified Sevas, Flagged/Rejected orders.
   - Quick 1-click **"Approve & Mark Paid"** or **"Reject"** with notes.
   - Live Merchant UPI Settings: Update your UPI ID (`pa`), Payee Name (`pn`), or MCC directly without restarting the server.
   - Seva Catalog Management: Add or edit Sevas, fees, and prasadam descriptions.
   - Protected by constant-time PIN authentication.

6. **Instant Polling & Digital Receipt**:
   - The customer portal polls order status; the moment Admin verifies an order, the devotee screen instantly displays a green verified checkmark and a printable digital seva receipt.

---

## 🚀 How to Run the Application

### 1. Open Terminal in the Project Directory
```powershell
cd d:\Payment
```

### 2. Configure Environment (Optional)
The project comes with pre-configured defaults in `.env`. You can edit `.env` or update it later via the Admin UI:
```env
PORT=3000
MERCHANT_VPA=templetrust@upi
MERCHANT_NAME=Sri Seva Charitable Trust
ADMIN_PIN=admin123
ORDER_EXPIRY_MINUTES=20
```

### 3. Start the Server
Run using `npm.cmd` or `node`:
```powershell
cmd /c npm start
```
*Or directly with Node:*
```powershell
node server.js
```

### 4. Access the Applications
- **Devotee / Customer Portal**: [http://localhost:3000](http://localhost:3000)
- **Admin Reconciliation Dashboard**: [http://localhost:3000/admin](http://localhost:3000/admin)
  - **Default Security PIN**: `admin123`

---

## 🔄 End-to-End Walkthrough

1. **Devotee Journey**:
   - Devotee visits [http://localhost:3000](http://localhost:3000).
   - Selects a Seva (e.g. *Nitya Archana & Sankalpam* - ₹151).
   - Enters their Name, Mobile Number, and Gotram/Nakshatram.
   - Clicks **"Proceed to UPI Payment"**.
   - On Mobile: Taps **Google Pay**, **PhonePe**, or **Paytm** to open the app directly with the pre-filled amount and reference.
   - On Desktop: Scans the dynamic QR code using any UPI app.
   - Completes payment and copies the 12-digit UTR from the payment confirmation screen.
   - Pastes the 12-digit UTR into the portal and clicks **"Verify & Confirm Payment"**.
   - The screen shows *"Payment Reference Submitted • Awaiting Verification"*.

2. **Merchant / Admin Reconciliation**:
   - Admin opens [http://localhost:3000/admin](http://localhost:3000/admin) and enters PIN `admin123`.
   - Sees the new transaction under **"Pending UTRs"**.
   - Copies the UTR or matches it against their bank SMS / mobile banking app statement.
   - Clicks **"✓ Approve"**.
   - The devotee's screen instantly updates with confetti and a printable digital receipt!
