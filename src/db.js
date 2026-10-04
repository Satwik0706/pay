const fs = require('fs');
const path = require('path');
const config = require('./config');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SERVICES_FILE = path.join(DATA_DIR, 'services.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial default services for Seva / Services portal
const DEFAULT_SERVICES = [
  {
    id: 'seva_archana',
    title: 'Nitya Archana & Sankalpam',
    category: 'Daily Seva',
    description: 'Special Archana performed with your family Gotra and Nakshatra names with sacred blessings.',
    amount: 151,
    active: true,
    badge: 'Popular',
    icon: '🪔',
    benefits: ['Personalized Sankalpa Mantra', 'Blessed Prasadam Dispatched', 'Digital Receipt with Gotram']
  },
  {
    id: 'seva_abhishekam',
    title: 'Rudrabhishekam Maha Seva',
    category: 'Special Seva',
    description: 'Elaborate sacred bathing ritual with 11 holy offerings including Panchamrita, Honey, and Chandan.',
    amount: 501,
    active: true,
    badge: 'Most Sacred',
    icon: '🕉️',
    benefits: ['Live Video Stream Access', 'Special Silver Coin Prasadam', 'Priest Consultation Blessing']
  },
  {
    id: 'seva_annadhanam',
    title: 'Annadanam Seva (Feed 25 Devotees)',
    category: 'Annadanam',
    description: 'Sponsor wholesome, delicious vegetarian meals and nourishment for 25 pilgrims and underprivileged devotees.',
    amount: 1100,
    active: true,
    badge: 'High Merit',
    icon: '🍲',
    benefits: ['Annadhanam Certificate of Merit', 'Names displayed on Daily Seva Board', 'Tax Exemption Receipt']
  },
  {
    id: 'seva_kalyanam',
    title: 'Divya Kalyana Mahotsavam',
    category: 'Special Seva',
    description: 'Celestial divine wedding ceremony for harmony, prosperity, and marital bliss.',
    amount: 2501,
    active: true,
    badge: 'Grand Seva',
    icon: '✨',
    benefits: ['Sacred Vastram Prasadam', 'Vedic Priest Blessings', 'VIP Darshan Pass']
  },
  {
    id: 'seva_navagraha',
    title: 'Navagraha Shanti Homam',
    category: 'Homa & Yagna',
    description: 'Vedic fire ceremony invoked to alleviate planetary afflictions, removing obstacles in career and health.',
    amount: 1501,
    active: true,
    badge: 'Protective',
    icon: '🔥',
    benefits: ['Sacred Bhasma & Raksha Sutra', 'Individual Homa Sankalpa', 'Vedic Astrological Peace']
  },
  {
    id: 'seva_vidya',
    title: 'Saraswati Vidya Daan Seva',
    category: 'Education & Charity',
    description: 'Support educational kits, notebooks, and school supplies for children from rural communities.',
    amount: 751,
    active: true,
    badge: 'Charity',
    icon: '📚',
    benefits: ['Student Gratitude Letter', 'Direct Community Impact Report', 'Donor Wall Acknowledgement']
  }
];

const DEFAULT_SETTINGS = {
  merchantVpa: config.merchant.vpa,
  merchantName: config.merchant.name,
  merchantCategoryCode: config.merchant.mcc,
  orderExpiryMinutes: config.order.expiryMinutes,
};

// Safe JSON file operations
function readJSON(filePath, fallbackData) {
  try {
    if (!fs.existsSync(filePath)) {
      writeJSON(filePath, fallbackData);
      return fallbackData;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return fallbackData;
  }
}

function writeJSON(filePath, data) {
  try {
    const tempPath = `${filePath}.tmp_${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
    throw err;
  }
}

// Initialise DB files if missing
if (!fs.existsSync(SERVICES_FILE)) {
  writeJSON(SERVICES_FILE, DEFAULT_SERVICES);
}
if (!fs.existsSync(ORDERS_FILE)) {
  writeJSON(ORDERS_FILE, []);
}
if (!fs.existsSync(SETTINGS_FILE)) {
  writeJSON(SETTINGS_FILE, DEFAULT_SETTINGS);
}

const db = {
  // Services
  getServices(onlyActive = true) {
    const services = readJSON(SERVICES_FILE, DEFAULT_SERVICES);
    if (onlyActive) {
      return services.filter(s => s.active !== false);
    }
    return services;
  },

  getServiceById(id) {
    const services = readJSON(SERVICES_FILE, DEFAULT_SERVICES);
    return services.find(s => s.id === id) || null;
  },

  createService(serviceData) {
    const services = readJSON(SERVICES_FILE, DEFAULT_SERVICES);
    const newService = {
      id: serviceData.id || `seva_${Date.now()}`,
      title: serviceData.title,
      category: serviceData.category || 'General',
      description: serviceData.description || '',
      amount: parseFloat(serviceData.amount),
      active: serviceData.active !== false,
      badge: serviceData.badge || '',
      icon: serviceData.icon || '✨',
      benefits: Array.isArray(serviceData.benefits) ? serviceData.benefits : [],
      createdAt: new Date().toISOString()
    };
    services.push(newService);
    writeJSON(SERVICES_FILE, services);
    return newService;
  },

  updateService(id, updates) {
    const services = readJSON(SERVICES_FILE, DEFAULT_SERVICES);
    const index = services.findIndex(s => s.id === id);
    if (index === -1) return null;

    if (updates.amount !== undefined) {
      updates.amount = parseFloat(updates.amount);
    }

    services[index] = { ...services[index], ...updates };
    writeJSON(SERVICES_FILE, services);
    return services[index];
  },

  deleteService(id) {
    const services = readJSON(SERVICES_FILE, DEFAULT_SERVICES);
    const filtered = services.filter(s => s.id !== id);
    if (filtered.length === services.length) return false;
    writeJSON(SERVICES_FILE, filtered);
    return true;
  },

  // Orders
  createOrder(order) {
    const orders = readJSON(ORDERS_FILE, []);
    orders.push(order);
    writeJSON(ORDERS_FILE, orders);
    return order;
  },

  getOrderById(orderId) {
    const orders = readJSON(ORDERS_FILE, []);
    return orders.find(o => o.orderId === orderId) || null;
  },

  getOrderByUTR(utr) {
    if (!utr) return null;
    const cleanUtr = String(utr).trim();
    const orders = readJSON(ORDERS_FILE, []);
    return orders.find(o => o.utr === cleanUtr) || null;
  },

  getAllOrders(filters = {}) {
    let orders = readJSON(ORDERS_FILE, []);
    
    // Auto-update expired orders
    const now = new Date();
    let updatedAny = false;
    orders = orders.map(order => {
      if (
        order.status === 'PENDING_PAYMENT' &&
        new Date(order.expiresAt) < now
      ) {
        updatedAny = true;
        return { ...order, status: 'EXPIRED' };
      }
      return order;
    });

    if (updatedAny) {
      writeJSON(ORDERS_FILE, orders);
    }

    if (filters.status) {
      orders = orders.filter(o => o.status === filters.status);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      orders = orders.filter(o => 
        o.orderId.toLowerCase().includes(q) ||
        (o.customerName && o.customerName.toLowerCase().includes(q)) ||
        (o.customerPhone && o.customerPhone.includes(q)) ||
        (o.utr && o.utr.includes(q)) ||
        (o.serviceTitle && o.serviceTitle.toLowerCase().includes(q))
      );
    }

    // Sort newest first
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return orders;
  },

  updateOrder(orderId, updates) {
    const orders = readJSON(ORDERS_FILE, []);
    const index = orders.findIndex(o => o.orderId === orderId);
    if (index === -1) return null;

    orders[index] = { ...orders[index], ...updates };
    writeJSON(ORDERS_FILE, orders);
    return orders[index];
  },

  // Settings
  getSettings() {
    return readJSON(SETTINGS_FILE, DEFAULT_SETTINGS);
  },

  updateSettings(newSettings) {
    const current = readJSON(SETTINGS_FILE, DEFAULT_SETTINGS);
    const updated = { ...current, ...newSettings };
    writeJSON(SETTINGS_FILE, updated);
    return updated;
  },

  // Analytics / Statistics
  getStats() {
    const orders = readJSON(ORDERS_FILE, []);
    const totalOrders = orders.length;
    const verifiedOrders = orders.filter(o => o.status === 'VERIFIED');
    const pendingUtr = orders.filter(o => o.status === 'UTR_SUBMITTED');
    const pendingPayment = orders.filter(o => o.status === 'PENDING_PAYMENT');
    const rejectedOrders = orders.filter(o => o.status === 'REJECTED');

    const totalCollected = verifiedOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
    const pendingVerificationAmount = pendingUtr.reduce((sum, o) => sum + (o.amount || 0), 0);

    return {
      totalOrders,
      verifiedCount: verifiedOrders.length,
      pendingVerificationCount: pendingUtr.length,
      pendingPaymentCount: pendingPayment.length,
      rejectedCount: rejectedOrders.length,
      totalCollected,
      pendingVerificationAmount
    };
  }
};

module.exports = db;
