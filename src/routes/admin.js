const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyAdminPin, sanitizeString } = require('../utils/security');

// Admin Auth Middleware
function requireAdminAuth(req, res, next) {
  const pin = req.headers['x-admin-pin'] || req.query.adminPin;
  if (!pin || !verifyAdminPin(pin)) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or missing Admin PIN'
    });
  }
  next();
}

// POST /api/admin/login - Verify admin PIN
router.post('/login', (req, res) => {
  const { pin } = req.body;
  if (!pin || !verifyAdminPin(pin)) {
    return res.status(401).json({ success: false, message: 'Invalid Admin PIN' });
  }
  res.json({ success: true, message: 'Admin authentication successful' });
});

// All routes below require Admin Auth
router.use(requireAdminAuth);

// GET /api/admin/stats - Overview metrics
router.get('/stats', (req, res) => {
  try {
    const stats = db.getStats();
    res.json({ success: true, stats });
  } catch (err) {
    console.error('Error fetching admin stats:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve stats' });
  }
});

// GET /api/admin/orders - Retrieve orders with filters
router.get('/orders', (req, res) => {
  try {
    const { status, search } = req.query;
    const orders = db.getAllOrders({ status, search });
    res.json({ success: true, orders, count: orders.length });
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve orders' });
  }
});

// POST /api/admin/orders/:orderId/verify - Approve & mark order as verified/paid
router.post('/orders/:orderId/verify', (req, res) => {
  try {
    const { orderId } = req.params;
    const { adminNotes } = req.body;

    const order = db.getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const updated = db.updateOrder(orderId, {
      status: 'VERIFIED',
      verifiedAt: new Date().toISOString(),
      verifiedBy: 'Administrator',
      adminNotes: sanitizeString(adminNotes || 'Payment confirmed via Bank/UPI statement', 200)
    });

    res.json({
      success: true,
      message: `Order ${orderId} has been successfully verified!`,
      order: updated
    });
  } catch (err) {
    console.error('Error verifying order:', err);
    res.status(500).json({ success: false, message: 'Failed to verify order' });
  }
});

// POST /api/admin/orders/:orderId/reject - Reject order with reason
router.post('/orders/:orderId/reject', (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = db.getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const updated = db.updateOrder(orderId, {
      status: 'REJECTED',
      verifiedAt: new Date().toISOString(),
      verifiedBy: 'Administrator',
      adminNotes: sanitizeString(reason || 'UTR verification failed or amount mismatch', 200)
    });

    res.json({
      success: true,
      message: `Order ${orderId} marked as rejected.`,
      order: updated
    });
  } catch (err) {
    console.error('Error rejecting order:', err);
    res.status(500).json({ success: false, message: 'Failed to reject order' });
  }
});

// GET /api/admin/settings - Get settings
router.get('/settings', (req, res) => {
  try {
    const settings = db.getSettings();
    res.json({ success: true, settings });
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
});

// POST /api/admin/settings - Update merchant settings
router.post('/settings', (req, res) => {
  try {
    const { merchantVpa, merchantName, merchantCategoryCode, orderExpiryMinutes } = req.body;

    if (!merchantVpa || !merchantVpa.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Merchant UPI ID (must contain @, e.g. name@bank)'
      });
    }

    const updated = db.updateSettings({
      merchantVpa: sanitizeString(merchantVpa, 50),
      merchantName: sanitizeString(merchantName, 80),
      merchantCategoryCode: sanitizeString(merchantCategoryCode || '8661', 10),
      orderExpiryMinutes: parseInt(orderExpiryMinutes || '20', 10)
    });

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: updated
    });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
});

// CRUD for Sevas/Services in Admin
router.get('/services', (req, res) => {
  try {
    const services = db.getServices(false); // get all including inactive
    res.json({ success: true, services });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get services' });
  }
});

router.post('/services', (req, res) => {
  try {
    const { title, category, description, amount, badge, icon, benefits } = req.body;
    if (!title || !amount) {
      return res.status(400).json({ success: false, message: 'Title and amount are required' });
    }

    const newService = db.createService({
      title: sanitizeString(title, 100),
      category: sanitizeString(category || 'General', 50),
      description: sanitizeString(description || '', 300),
      amount: parseFloat(amount),
      badge: sanitizeString(badge || '', 30),
      icon: sanitizeString(icon || '✨', 10),
      benefits: Array.isArray(benefits) ? benefits.map(b => sanitizeString(b, 100)) : []
    });

    res.status(201).json({ success: true, message: 'Service added successfully', service: newService });
  } catch (err) {
    console.error('Error creating service:', err);
    res.status(500).json({ success: false, message: 'Failed to create service' });
  }
});

router.put('/services/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updated = db.updateService(id, updates);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    res.json({ success: true, message: 'Service updated successfully', service: updated });
  } catch (err) {
    console.error('Error updating service:', err);
    res.status(500).json({ success: false, message: 'Failed to update service' });
  }
});

router.delete('/services/:id', (req, res) => {
  try {
    const { id } = req.params;
    const ok = db.deleteService(id);
    if (!ok) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    res.json({ success: true, message: 'Service deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete service' });
  }
});

module.exports = router;
