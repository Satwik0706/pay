const QRCode = require('qrcode');

/**
 * Generate UPI deep link URLs for standard and specific UPI applications
 */
function buildUpiLinks({ vpa, name, amount, orderId, note, mcc }) {
  const formattedAmount = parseFloat(amount).toFixed(2);
  const cleanNote = (note || `Payment for ${orderId}`).slice(0, 50);

  // Standard UPI URI query params
  const params = new URLSearchParams({
    pa: vpa,
    pn: name,
    tr: orderId,
    tn: cleanNote,
    am: formattedAmount,
    cu: 'INR',
  });

  // Only include mc if specifically configured and not dummy/default
  if (mcc && mcc !== '8661' && mcc !== 'default') {
    params.set('mc', mcc);
  }

  // Ensure RFC 3986 percent-encoding (spaces as %20, not +) for strict UPI app parsers
  const queryString = params.toString().replace(/\+/g, '%20');

  const genericUri = `upi://pay?${queryString}`;

  return {
    // Standard universal UPI protocol (triggers OS intent chooser on iOS & fallback)
    generic: genericUri,

    // Android Universal Intent (pops native Android bottom sheet for ANY installed UPI app)
    androidIntent: `intent://upi/pay?${queryString}#Intent;scheme=upi;end;`,

    // Google Pay: Android explicit package intent
    gpay: `intent://upi/pay?${queryString}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.google.android.apps.nbu.paisa.user;end;`,

    // PhonePe: Android explicit package intent
    phonepe: `intent://upi/pay?${queryString}#Intent;scheme=upi;package=com.phonepe.app;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.phonepe.app;end;`,

    // Paytm: Android explicit package intent
    paytm: `intent://upi/pay?${queryString}#Intent;scheme=upi;package=net.one97.paytm;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dnet.one97.paytm;end;`,

    // BHIM: Android explicit package intent
    bhim: `intent://upi/pay?${queryString}#Intent;scheme=upi;package=in.org.npci.upiapp;end;`,

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
