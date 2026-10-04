const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/services - Retrieve active services/sevas
router.get('/', (req, res) => {
  try {
    const services = db.getServices(true);
    res.json({
      success: true,
      services
    });
  } catch (err) {
    console.error('Error fetching services:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve services' });
  }
});

// GET /api/services/:id - Retrieve single service
router.get('/:id', (req, res) => {
  try {
    const service = db.getServiceById(req.params.id);
    if (!service || !service.active) {
      return res.status(404).json({ success: false, message: 'Service not found or inactive' });
    }
    res.json({ success: true, service });
  } catch (err) {
    console.error('Error fetching service:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve service' });
  }
});

module.exports = router;
