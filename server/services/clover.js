/**
 * Clover API Service
 * Handles payment processing and receipt printing via Clover API
 */

// Lazy-load configuration to ensure environment variables are loaded first
// This prevents issues with ES module hoisting where imports happen before dotenv.config()
let CLOVER_API_BASE_URL;
let CLOVER_API_KEY;
let CLOVER_MERCHANT_ID;
let configInitialized = false;

/**
 * Initialize Clover configuration (called lazily on first use)
 */
function initializeConfig() {
  if (configInitialized) {
    return;
  }

  const environment = process.env.CLOVER_ENVIRONMENT || "sandbox";
  CLOVER_API_BASE_URL =
    environment === "production"
      ? "https://api.clover.com"
      : "https://sandbox.dev.clover.com";

  CLOVER_API_KEY = process.env.CLOVER_API_KEY;
  CLOVER_MERCHANT_ID = process.env.CLOVER_MERCHANT_ID;

  configInitialized = true;
}

/**
 * Get Clover API headers with authentication
 */
function getCloverHeaders() {
  initializeConfig(); // Ensure config is loaded
  return {
    Authorization: `Bearer ${CLOVER_API_KEY}`,
    "Content-Type": "application/json",
  };
}

/**
 * Process a payment through Clover
 * @param {Object} paymentData - Payment information
 * @param {number} paymentData.amount - Amount in cents
 * @param {string} paymentData.source - Payment source token from Clover iFrame
 * @param {string} paymentData.orderId - Order ID (optional, for tracking)
 * @param {string} paymentData.currency - Currency code (default: USD)
 * @returns {Promise<Object>} Payment result
 */
export async function processPayment(paymentData) {
  initializeConfig(); // Ensure config is loaded before use
  const { amount, source, orderId, currency = "USD" } = paymentData;

  if (!CLOVER_API_KEY || !CLOVER_MERCHANT_ID) {
    throw new Error("Clover API credentials not configured");
  }

  if (!source) {
    throw new Error("Payment source token is required");
  }

  if (!amount || amount <= 0) {
    throw new Error("Valid payment amount is required");
  }

  try {
    // Create a charge using Clover API
    const chargeUrl = `${CLOVER_API_BASE_URL}/v3/merchants/${CLOVER_MERCHANT_ID}/charges`;

    const chargePayload = {
      amount: Math.round(amount), // Ensure amount is in cents
      currency: currency.toLowerCase(),
      source: source, // Token from Clover iFrame
      description: orderId ? `Order #${orderId}` : "Online Order",
      capture: true, // Capture immediately (not just authorize)
    };

    const response = await fetch(chargeUrl, {
      method: "POST",
      headers: getCloverHeaders(),
      body: JSON.stringify(chargePayload),
    });

    const result = await response.json();

    if (!response.ok) {
      const errorMessage =
        result.error?.message || result.message || "Payment processing failed";
      throw new Error(errorMessage);
    }

    return {
      success: true,
      chargeId: result.id,
      amount: result.amount,
      currency: result.currency,
      status: result.status,
      paymentRef: result.id, // Store this in order.paymentRef
    };
  } catch (error) {
    console.error("Clover payment processing error:", error);
    throw error;
  }
}

/**
 * Get available printers for the merchant
 * @returns {Promise<Array>} Array of printer objects
 */
export async function getPrinters() {
  initializeConfig(); // Ensure config is loaded before use
  if (!CLOVER_API_KEY || !CLOVER_MERCHANT_ID) {
    throw new Error("Clover API credentials not configured");
  }

  try {
    const printersUrl = `${CLOVER_API_BASE_URL}/v3/merchants/${CLOVER_MERCHANT_ID}/printers`;

    const response = await fetch(printersUrl, {
      method: "GET",
      headers: getCloverHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Failed to retrieve printers");
    }

    const result = await response.json();
    return result.elements || [];
  } catch (error) {
    console.error("Clover get printers error:", error);
    throw error;
  }
}

/**
 * Print a receipt for an order
 * @param {Object} order - Order object
 * @param {string} printerId - Optional printer ID (if not provided, uses first available printer)
 * @returns {Promise<Object>} Print result
 */
export async function printReceipt(order, printerId = null) {
  initializeConfig(); // Ensure config is loaded before use
  if (!CLOVER_API_KEY || !CLOVER_MERCHANT_ID) {
    throw new Error("Clover API credentials not configured");
  }

  try {
    // Get printer ID if not provided
    let targetPrinterId = printerId;
    if (!targetPrinterId) {
      const printers = await getPrinters();
      if (printers.length === 0) {
        throw new Error("No printers available");
      }
      targetPrinterId = printers[0].id;
    }

    // Format receipt content
    const receiptLines = formatReceiptContent(order);

    // Send print command
    const printUrl = `${CLOVER_API_BASE_URL}/v3/merchants/${CLOVER_MERCHANT_ID}/printers/${targetPrinterId}/print`;

    const printPayload = {
      lines: receiptLines,
    };

    const response = await fetch(printUrl, {
      method: "POST",
      headers: getCloverHeaders(),
      body: JSON.stringify(printPayload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Failed to print receipt");
    }

    const result = await response.json();
    return {
      success: true,
      printerId: targetPrinterId,
      printJobId: result.id,
    };
  } catch (error) {
    console.error("Clover print receipt error:", error);
    // Don't throw - receipt printing failure shouldn't fail the order
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Format order data into receipt lines for printing
 * @param {Object} order - Order object
 * @returns {Array} Array of receipt line objects
 */
function formatReceiptContent(order) {
  const lines = [];

  // Header
  lines.push({
    type: "TEXT",
    text: "WILD BEAN COFFEE",
    align: "CENTER",
    bold: true,
  });
  lines.push({ type: "TEXT", text: "ONLINE ORDER", align: "CENTER" });
  lines.push({ type: "TEXT", text: "---", align: "CENTER" });

  // Order info
  lines.push({
    type: "TEXT",
    text: `Order #: ${order._id.toString().slice(-8)}`,
    align: "LEFT",
  });
  lines.push({
    type: "TEXT",
    text: `Customer: ${order.customer.name}`,
    align: "LEFT",
  });
  lines.push({
    type: "TEXT",
    text: `Phone: ${order.customer.phone}`,
    align: "LEFT",
  });
  if (order.customer.email) {
    lines.push({
      type: "TEXT",
      text: `Email: ${order.customer.email}`,
      align: "LEFT",
    });
  }
  if (order.pickupTime) {
    const pickupDate = new Date(order.pickupTime);
    lines.push({
      type: "TEXT",
      text: `Pickup: ${pickupDate.toLocaleString()}`,
      align: "LEFT",
    });
  }
  lines.push({ type: "TEXT", text: "---", align: "CENTER" });

  // Items
  lines.push({ type: "TEXT", text: "ITEMS:", align: "LEFT", bold: true });
  order.items.forEach((item) => {
    lines.push({
      type: "TEXT",
      text: `${item.quantity}x ${item.name}`,
      align: "LEFT",
    });
    const itemTotal = (item.price * item.quantity).toFixed(2);
    lines.push({ type: "TEXT", text: `  $${itemTotal}`, align: "RIGHT" });
  });
  lines.push({ type: "TEXT", text: "---", align: "CENTER" });

  // Totals
  lines.push({
    type: "TEXT",
    text: `Subtotal: $${order.totals.subtotal.toFixed(2)}`,
    align: "LEFT",
  });
  lines.push({
    type: "TEXT",
    text: `Tax: $${order.totals.tax.toFixed(2)}`,
    align: "LEFT",
  });
  lines.push({
    type: "TEXT",
    text: `TOTAL: $${order.totals.total.toFixed(2)}`,
    align: "LEFT",
    bold: true,
  });

  // Payment status
  if (order.paymentStatus === "paid") {
    lines.push({ type: "TEXT", text: "PAID", align: "CENTER", bold: true });
    if (order.paymentRef) {
      lines.push({
        type: "TEXT",
        text: `Payment ID: ${order.paymentRef.slice(-8)}`,
        align: "CENTER",
      });
    }
  }

  // Notes
  if (order.notes) {
    lines.push({ type: "TEXT", text: "---", align: "CENTER" });
    lines.push({ type: "TEXT", text: "NOTES:", align: "LEFT", bold: true });
    lines.push({ type: "TEXT", text: order.notes, align: "LEFT" });
  }

  // Footer
  lines.push({ type: "TEXT", text: "---", align: "CENTER" });
  lines.push({
    type: "TEXT",
    text: "Thank you for your order!",
    align: "CENTER",
  });
  lines.push({
    type: "TEXT",
    text: new Date().toLocaleString(),
    align: "CENTER",
  });

  return lines;
}

/**
 * Verify a payment token from Clover iFrame
 * @param {string} token - Payment token from iFrame
 * @returns {Promise<Object>} Token verification result
 */
export async function verifyPaymentToken(token) {
  initializeConfig(); // Ensure config is loaded before use
  if (!CLOVER_API_KEY || !CLOVER_MERCHANT_ID) {
    throw new Error("Clover API credentials not configured");
  }

  try {
    // Verify token with Clover API
    const verifyUrl = `${CLOVER_API_BASE_URL}/v3/merchants/${CLOVER_MERCHANT_ID}/tokens/${token}`;

    const response = await fetch(verifyUrl, {
      method: "GET",
      headers: getCloverHeaders(),
    });

    if (!response.ok) {
      throw new Error("Invalid payment token");
    }

    const result = await response.json();
    return {
      valid: true,
      token: result.id,
    };
  } catch (error) {
    console.error("Clover token verification error:", error);
    return {
      valid: false,
      error: error.message,
    };
  }
}
