const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./src/config');

const servicesRouter = require('./src/routes/services');
const ordersRouter = require('./src/routes/orders');
const adminRouter = require('./src/routes/admin');

const app = express();

// Trust reverse proxy for Render / Cloudflare / Heroku to enable accurate rate limiting
app.set('trust proxy', 1);

// Security HTTP headers with relaxed CSP for inline app scripts & Google Fonts
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

app.use(cors());
app.use(express.json({ limit: '500kb' }));
app.use(express.urlencoded({ extended: true, limit: '500kb' }));

// Rate limiter for general API to mitigate DDoS & automated abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again shortly.' }
});

// Stricter rate limiter for order creation & UTR submission
const orderLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // max 30 orders/submissions per 5 mins per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many payment requests. Please wait a moment.' }
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/services', apiLimiter, servicesRouter);
app.use('/api/orders', orderLimiter, ordersRouter);
app.use('/api/admin', apiLimiter, adminRouter);

// Clean SPA routing
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Fallback for SPA routing & API 404
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handling
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error occurred.'
  });
});

const PORT = process.env.PORT || config.port || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`  🛡️  SECURE UPI PAYMENT PANEL (OPTION B) ACTIVE    `);
  console.log(`====================================================`);
  console.log(`  🌐 Customer Portal  : http://localhost:${PORT}`);
  console.log(`  🔐 Admin Dashboard  : http://localhost:${PORT}/admin`);
  console.log(`  🔑 Default Admin PIN: ${config.security.adminPin}`);
  console.log(`  💳 Merchant VPA     : ${config.merchant.vpa}`);
  console.log(`  🏛️  Merchant Name   : ${config.merchant.name}`);
  console.log(`====================================================`);
});

module.exports = app;
