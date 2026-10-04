const QRCode = require('qrcode');

/**
 * Generate UPI deep link URLs for standard and specific UPI applications
 */
function buildUpiLinks({ vpa, name, amount, orderId, note, mcc = '8661' }) {
  const formattedAmount = parseFloat(amount).toFixed(2);
  const cleanNote = (note || `Payment for ${orderId}`).slice(0, 50);

  // Standard UPI URI query params
  const params = new URLSearchParams({
    pa: vpa,
    pn: name,
    mc: mcc,
    tr: orderId,
    tn: cleanNote,
    am: formattedAmount,
    cu: 'INR',
  });

  const queryString = params.toString();

  const genericUri = `upi://pay?${queryString}`;

  return {
    // Standard universal UPI protocol (triggers OS intent chooser on mobile: GPay, PhonePe, Paytm, Cred, BHIM)
    generic: genericUri,

    // Google Pay: Android Intent targeting package + Tez fallback
    gpay: `intent://pay?${queryString}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`,
    gpayScheme: `tez://upi/pay?${queryString}`,

    // PhonePe: Android Intent targeting package + scheme fallback
    phonepe: `intent://pay?${queryString}#Intent;scheme=upi;package=com.phonepe.app;end`,
    phonepeScheme: `phonepe://pay?${queryString}`,

    // Paytm: Android Intent targeting package + scheme fallback
    paytm: `intent://pay?${queryString}#Intent;scheme=upi;package=net.one97.paytm;end`,
    paytmScheme: `paytmmp://pay?${queryString}`,

    // BHIM direct intent
    bhim: `intent://pay?${queryString}#Intent;scheme=upi;package=in.org.npci.upiapp;end`,

    // Raw query params for debugging/inspection
    query: queryString,
    amount: formattedAmount,
    payeeVpa: vpa,
    payeeName: name
  };
}

/**
 * Generate dynamic QR Code Data URL for scanning
 */
async function generateUpiQrCode(upiUri) {
  try {
    return await QRCode.toDataURL(upiUri, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: {
        dark: '#1e1b4b', // deep indigo
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('Failed to generate UPI QR Code:', err);
    throw err;
  }
}

module.exports = {
  buildUpiLinks,
  generateUpiQrCode
};
