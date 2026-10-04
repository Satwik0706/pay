const crypto = require('crypto');
const config = require('../config');

/**
 * Generate a tamper-proof HMAC signature for an order
 */
function generateOrderSignature(orderId, amount, serviceId, createdAt) {
  const payload = `${orderId}|${parseFloat(amount).toFixed(2)}|${serviceId}|${createdAt}`;
  return crypto
    .createHmac('sha256', config.security.orderSecretKey)
    .update(payload)
    .digest('hex');
}

/**
 * Verify an order signature to prevent tampering
 */
function verifyOrderSignature(order) {
  if (!order || !order.signature) return false;
  const expectedSignature = generateOrderSignature(
    order.orderId,
    order.amount,
    order.serviceId,
    order.createdAt
  );
  return crypto.timingSafeEqual(
    Buffer.from(order.signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * Validate NPCI 12-digit UPI UTR (Unique Transaction Reference)
 * NPCI UTRs are strictly 12 numeric digits.
 */
function validateUTR(utr) {
  if (!utr || typeof utr !== 'string') return false;
  const clean = utr.trim();
  return /^\d{12}$/.test(clean);
}

/**
 * Sanitize string input to prevent XSS and script injection
 */
function sanitizeString(str, maxLength = 150) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>'"`;\\]/g, '') // remove HTML/script special chars
    .trim()
    .slice(0, maxLength);
}

/**
 * Constant-time string comparison for Admin PIN authentication
 */
function verifyAdminPin(providedPin) {
  if (!providedPin || typeof providedPin !== 'string') return false;
  const expectedPin = config.security.adminPin;
  if (providedPin.length !== expectedPin.length) {
    return false;
  }
  return crypto.timingSafeEqual(
    Buffer.from(providedPin, 'utf8'),
    Buffer.from(expectedPin, 'utf8')
  );
}

module.exports = {
  generateOrderSignature,
  verifyOrderSignature,
  validateUTR,
  sanitizeString,
  verifyAdminPin
};
