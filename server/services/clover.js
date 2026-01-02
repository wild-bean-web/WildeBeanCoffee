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

  console.log(
    "[CLOVER SERVICE] ========== INITIALIZING CONFIGURATION =========="
  );
  console.log("[CLOVER SERVICE] Loading environment variables...");

  const environment = process.env.CLOVER_ENVIRONMENT || "sandbox";
  CLOVER_API_BASE_URL =
    environment === "production"
      ? "https://api.clover.com"
      : "https://sandbox.dev.clover.com";

  CLOVER_API_KEY = process.env.CLOVER_API_KEY;
  CLOVER_MERCHANT_ID = process.env.CLOVER_MERCHANT_ID;

  console.log(
    "[CLOVER SERVICE] Environment Variables:",
    JSON.stringify(
      {
        CLOVER_ENVIRONMENT: environment,
        CLOVER_API_BASE_URL: CLOVER_API_BASE_URL,
        CLOVER_API_KEY: CLOVER_API_KEY
          ? CLOVER_API_KEY.substring(0, 10) +
            "... (length: " +
            CLOVER_API_KEY.length +
            ")"
          : "MISSING",
        CLOVER_MERCHANT_ID: CLOVER_MERCHANT_ID || "MISSING",
        apiKeyConfigured: !!CLOVER_API_KEY,
        merchantIdConfigured: !!CLOVER_MERCHANT_ID,
      },
      null,
      2
    )
  );

  if (!CLOVER_API_KEY || !CLOVER_MERCHANT_ID) {
    console.error("[CLOVER SERVICE] ⚠️  WARNING: Missing Clover credentials!");
  } else {
    console.log("[CLOVER SERVICE] ✅ All credentials configured");
  }

  console.log("[CLOVER SERVICE] ============================================");
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
 * @param {string} paymentData.source - Payment source token from Clover
 * @param {string} paymentData.orderId - Order ID (optional, for tracking)
 * @param {string} paymentData.currency - Currency code (default: USD)
 * @returns {Promise<Object>} Payment result
 */
export async function processPayment(paymentData) {
  console.log("[CLOVER SERVICE] ========== PROCESS PAYMENT START ==========");
  initializeConfig(); // Ensure config is loaded before use

  console.log("[CLOVER SERVICE] Step 14: Received payment data from route");
  console.log(
    "[CLOVER SERVICE] Payment data:",
    JSON.stringify(
      {
        amount: paymentData.amount,
        amountInDollars: (paymentData.amount / 100).toFixed(2),
        source: paymentData.source
          ? paymentData.source.substring(0, 30) +
            "... (length: " +
            paymentData.source.length +
            ")"
          : "MISSING",
        orderId: paymentData.orderId || "N/A",
        currency: paymentData.currency || "USD (default)",
      },
      null,
      2
    )
  );

  const { amount, source, orderId, currency = "USD" } = paymentData;

  console.log("[CLOVER SERVICE] Step 15: Validating credentials and data");
  if (!CLOVER_API_KEY || !CLOVER_MERCHANT_ID) {
    console.error("[CLOVER SERVICE] ❌ Validation FAILED: Missing credentials");
    console.error(
      "[CLOVER SERVICE] Missing:",
      JSON.stringify(
        {
          apiKey: !CLOVER_API_KEY,
          merchantId: !CLOVER_MERCHANT_ID,
        },
        null,
        2
      )
    );
    throw new Error("Clover API credentials not configured");
  }
  console.log("[CLOVER SERVICE] ✅ Credentials validation passed");

  if (!source) {
    console.error(
      "[CLOVER SERVICE] ❌ Validation FAILED: Missing source token"
    );
    throw new Error("Payment source token is required");
  }
  console.log("[CLOVER SERVICE] ✅ Source token validation passed");

  if (!amount || amount <= 0) {
    console.error(
      "[CLOVER SERVICE] ❌ Validation FAILED: Invalid amount",
      JSON.stringify({ amount }, null, 2)
    );
    throw new Error("Valid payment amount is required");
  }
  console.log("[CLOVER SERVICE] ✅ Amount validation passed");

  try {
    // Create a charge using Clover API
    const chargeUrl = `${CLOVER_API_BASE_URL}/v3/merchants/${CLOVER_MERCHANT_ID}/charges`;

    console.log("[CLOVER SERVICE] Step 16: Preparing Clover API request");
    console.log("[CLOVER SERVICE] API Endpoint:", chargeUrl);
    console.log("[CLOVER SERVICE] API Method: POST");
    console.log(
      "[CLOVER SERVICE] Current Configuration:",
      JSON.stringify(
        {
          baseUrl: CLOVER_API_BASE_URL,
          merchantId: CLOVER_MERCHANT_ID,
          apiKeyPrefix: CLOVER_API_KEY
            ? CLOVER_API_KEY.substring(0, 10) + "..."
            : "MISSING",
        },
        null,
        2
      )
    );

    const chargePayload = {
      amount: Math.round(amount), // Ensure amount is in cents
      currency: currency.toLowerCase(),
      source: source, // Payment token from Clover
      description: orderId ? `Order #${orderId}` : "Online Order",
      capture: true, // Capture immediately (not just authorize)
    };

    console.log(
      "[CLOVER SERVICE] Request Payload:",
      JSON.stringify(
        {
          amount: chargePayload.amount,
          amountInDollars: (chargePayload.amount / 100).toFixed(2),
          currency: chargePayload.currency,
          source:
            chargePayload.source.substring(0, 30) +
            "... (length: " +
            chargePayload.source.length +
            ")",
          description: chargePayload.description,
          capture: chargePayload.capture,
        },
        null,
        2
      )
    );
    console.log(
      "[CLOVER SERVICE] Full payload (JSON):",
      JSON.stringify(chargePayload, null, 2)
    );

    const headers = getCloverHeaders();
    console.log(
      "[CLOVER SERVICE] Request Headers:",
      JSON.stringify(
        {
          "Content-Type": headers["Content-Type"],
          Authorization: headers.Authorization
            ? headers.Authorization.substring(0, 20) + "..."
            : "MISSING",
        },
        null,
        2
      )
    );

    console.log("[CLOVER SERVICE] Step 17: Sending request to Clover API");
    const requestStartTime = Date.now();
    const response = await fetch(chargeUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(chargePayload),
    });
    const requestDuration = Date.now() - requestStartTime;

    console.log("[CLOVER SERVICE] Step 18: Clover API response received");
    console.log("[CLOVER SERVICE] Response duration:", requestDuration, "ms");
    console.log(
      "[CLOVER SERVICE] Response status:",
      response.status,
      response.statusText
    );
    console.log("[CLOVER SERVICE] Response OK:", response.ok);
    console.log(
      "[CLOVER SERVICE] Response headers:",
      JSON.stringify(
        {
          "content-type": response.headers.get("content-type"),
          "content-length": response.headers.get("content-length"),
        },
        null,
        2
      )
    );

    const result = await response.json();
    console.log(
      "[CLOVER SERVICE] Response body:",
      JSON.stringify(result, null, 2)
    );

    if (!response.ok) {
      console.error(
        "[CLOVER SERVICE] ❌ Step 18 FAILED: Clover API returned error"
      );
      console.error(
        "[CLOVER SERVICE] Error details:",
        JSON.stringify(
          {
            status: response.status,
            statusText: response.statusText,
            errorType: result.error?.type || "N/A",
            errorCode: result.error?.code || "N/A",
            errorMessage: result.error?.message || result.message || "N/A",
            fullError: result.error || result,
          },
          null,
          2
        )
      );
      const errorMessage =
        result.error?.message || result.message || "Payment processing failed";
      throw new Error(errorMessage);
    }

    const paymentResult = {
      success: true,
      chargeId: result.id,
      amount: result.amount,
      currency: result.currency,
      status: result.status,
      paymentRef: result.id, // Store this in order.paymentRef
    };

    console.log("[CLOVER SERVICE] ✅ Step 18 SUCCESS: Payment processed");
    console.log(
      "[CLOVER SERVICE] Payment result:",
      JSON.stringify(
        {
          success: paymentResult.success,
          chargeId: paymentResult.chargeId,
          amount: paymentResult.amount,
          amountInDollars: (paymentResult.amount / 100).toFixed(2),
          currency: paymentResult.currency,
          status: paymentResult.status,
        },
        null,
        2
      )
    );
    console.log("[CLOVER SERVICE] ========== PROCESS PAYMENT END ==========");
    console.log("═══════════════════════════════════════════════════════════");

    return paymentResult;
  } catch (error) {
    console.error(
      "[CLOVER SERVICE] ❌ PAYMENT PROCESSING ERROR:",
      error.message
    );
    console.error("[CLOVER SERVICE] Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    console.error(
      "[CLOVER SERVICE] ========== PROCESS PAYMENT END (ERROR) =========="
    );
    console.log("═══════════════════════════════════════════════════════════");
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

