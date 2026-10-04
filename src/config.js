require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  merchant: {
    vpa: process.env.MERCHANT_VPA || 'templetrust@upi',
    name: process.env.MERCHANT_NAME || 'Sri Seva Charitable Trust',
    mcc: process.env.MERCHANT_CATEGORY_CODE || '8661',
  },
  security: {
    orderSecretKey: process.env.ORDER_SECRET_KEY || 'default_secure_secret_key_change_in_prod',
    adminPin: process.env.ADMIN_PIN || 'admin123',
  },
  order: {
    expiryMinutes: parseInt(process.env.ORDER_EXPIRY_MINUTES || '20', 10),
  },
};
