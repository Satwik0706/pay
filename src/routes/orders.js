const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { generateOrderSignature, verifyOrderSignature, validateUTR, sanitizeString } = require('../utils/security');
const { buildUpiLinks, generateUpiQrCode } = require('../utils/upi');

// POST /api/orders/create - Create a secure order with backend-verified pricing
router.post('/create', async (req, res) => {
  try {
    const { serviceId, customerName, customerPhone, customerEmail, specialNotes } = req.body;

    // Validation
    if (!serviceId) {
      return res.status(400).json({ success: false, message: 'Please select a service or seva' });
    }
    if (!customerName || !customerName.trim()) {
      return res.status(400).json({ success: false, message: 'Customer name is required' });
    }
    if (!customerPhone || !customerPhone.trim()) {
      return res.status(400).json({ success: false, message: 'Contact phone number is required' });
    }

    // STRICT SECURITY: Fetch service price ONLY from backend storage, never from user request
    const service = db.getServiceById(serviceId);
    if (!service || !service.active) {
      return res.status(404).json({ success: false, message: 'Selected service is unavailable or inactive' });
    }

    const settings = db.getSettings();
    const orderId = `SEVA_${Date.now().toString(36).toUpperCase()}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const createdAt = new Date().toISOString();
    const expiryMinutes = settings.orderExpiryMinutes || 20;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();
    const amount = parseFloat(service.amount);

    // Cryptographic signature
    const signature = generateOrderSignature(orderId, amount, service.id, createdAt);

    // UPI Deep links
    const upiLinks = buildUpiLinks({
      vpa: settings.merchantVpa,
      name: settings.merchantName,
      amount: amount,
      orderId: orderId,
      note: `${service.title.slice(0, 25)} - ${orderId}`,
      mcc: settings.merchantCategoryCode
    });

    // Dynamic QR code for the universal UPI URI
    const qrCodeDataUrl = await generateUpiQrCode(upiLinks.generic);

    const orderData = {
      orderId,
      serviceId: service.id,
      serviceTitle: service.title,
      category: service.category,
      amount,
      customerName: sanitizeString(customerName, 80),
      customerPhone: sanitizeString(customerPhone, 20),
      customerEmail: sanitizeString(customerEmail || '', 100),
      specialNotes: sanitizeString(specialNotes || '', 200),
      merchantVpa: settings.merchantVpa,
      merchantName: settings.merchantName,
      status: 'PENDING_PAYMENT',
      utr: null,
      utrSubmittedAt: null,
      verifiedAt: null,
      verifiedBy: null,
      adminNotes: null,
      createdAt,
      expiresAt,
      signature
    };

    db.createOrder(orderData);

    res.status(201).json({
      success: true,
      order: {
        orderId,
        serviceTitle: service.title,
        amount,
        customerName: orderData.customerName,
        customerPhone: orderData.customerPhone,
        specialNotes: orderData.specialNotes,
        merchantVpa: settings.merchantVpa,
        merchantName: settings.merchantName,
        createdAt,
        expiresAt,
        status: 'PENDING_PAYMENT',
        upiLinks,
        qrCodeDataUrl
      }
    });
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ success: false, message: 'Server error while generating payment order' });
  }
});

// POST /api/orders/:orderId/submit-utr - Submit 12-digit UPI UTR for verification
router.post('/:orderId/submit-utr', (req, res) => {
  try {
    const { orderId } = req.params;
    const { utr } = req.body;

    const order = db.getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Tamper-proof check
    if (!verifyOrderSignature(order)) {
      return res.status(403).json({ success: false, message: 'Order integrity validation failed' });
    }

    // Expiry check
    if (new Date(order.expiresAt) < new Date() && order.status !== 'VERIFIED') {
      db.updateOrder(orderId, { status: 'EXPIRED' });
      return res.status(400).json({
        success: false,
        message: 'This payment session has expired. Please initiate a new order.'
      });
    }

    // Status check
    if (order.status === 'VERIFIED') {
      return res.status(400).json({
        success: false,
        message: 'This order is already verified and marked as paid.'
      });
    }

    // Validate 12-digit numeric UTR format
    const cleanUtr = String(utr || '').replace(/\s+/g, '');
    if (!validateUTR(cleanUtr)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid UPI Reference / UTR Number. Must be exactly 12 numeric digits.'
      });
    }

    // Replay / Double-spending attack prevention: check if UTR is already in use by another order
    const existingOrderWithUtr = db.getOrderByUTR(cleanUtr);
    if (existingOrderWithUtr && existingOrderWithUtr.orderId !== orderId) {
      return res.status(409).json({
        success: false,
        message: 'This UTR has already been submitted for another order. Each transaction reference can only be used once.'
      });
    }

    // Update order with UTR
    const updated = db.updateOrder(orderId, {
      utr: cleanUtr,
      utrSubmittedAt: new Date().toISOString(),
      status: 'UTR_SUBMITTED'
    });

    res.json({
      success: true,
      message: 'UTR submitted successfully. Your payment is in verification queue.',
      order: {
        orderId: updated.orderId,
        status: updated.status,
        utr: updated.utr,
        utrSubmittedAt: updated.utrSubmittedAt
      }
    });
  } catch (err) {
    console.error('Error submitting UTR:', err);
    res.status(500).json({ success: false, message: 'Server error while submitting UTR' });
  }
});

// GET /api/orders/:orderId/status - Check real-time status of an order
router.get('/:orderId/status', (req, res) => {
  try {
    const { orderId } = req.params;
    const order = db.getOrderById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check expiry
    if (order.status === 'PENDING_PAYMENT' && new Date(order.expiresAt) < new Date()) {
      db.updateOrder(orderId, { status: 'EXPIRED' });
      order.status = 'EXPIRED';
    }

    res.json({
      success: true,
      order: {
        orderId: order.orderId,
        serviceTitle: order.serviceTitle,
        amount: order.amount,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        specialNotes: order.specialNotes,
        status: order.status,
        utr: order.utr,
        createdAt: order.createdAt,
        expiresAt: order.expiresAt,
        verifiedAt: order.verifiedAt,
        adminNotes: order.adminNotes
      }
    });
  } catch (err) {
    console.error('Error checking order status:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve order status' });
  }
});

// GET /api/orders/:orderId/receipt - Get full receipt details
router.get('/:orderId/receipt', (req, res) => {
  try {
    const { orderId } = req.params;
    const order = db.getOrderById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const service = db.getServiceById(order.serviceId);

    res.json({
      success: true,
      receipt: {
        orderId: order.orderId,
        status: order.status,
        serviceTitle: order.serviceTitle,
        category: order.category,
        amount: order.amount,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerEmail: order.customerEmail,
        specialNotes: order.specialNotes,
        merchantName: order.merchantName,
        merchantVpa: order.merchantVpa,
        utr: order.utr,
        createdAt: order.createdAt,
        verifiedAt: order.verifiedAt,
        benefits: service ? service.benefits : []
      }
    });
  } catch (err) {
    console.error('Error retrieving receipt:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve receipt' });
  }
});

module.exports = router;
