/**
 * Centralized API client for Wild Bean Coffee
 * Handles all API communication with consistent error handling
 */

import { localDateRangeToUtcIsoBounds } from "@/lib/kitchenDateRange";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

/**
 * Get authentication token from localStorage
 */
function getAuthToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

/**
 * Base fetch function with error handling and authentication
 */
async function fetchJson(url, options = {}) {
  const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
  
  // Add auth token to headers if available
  const token = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  let response;
  try {
    response = await fetch(fullUrl, {
      ...options,
      headers,
      credentials: "include", // Include cookies for httpOnly cookie support
    });
  } catch (networkError) {
    // Network error (server not running, CORS, etc.)
    throw new Error(`Network error: ${networkError.message}. Make sure the server is running at ${API_BASE_URL || 'http://localhost:4000'}`);
  }

  if (!response.ok) {
    let errorMessage = `Request failed: ${response.status} ${response.statusText}`;
    try {
      // Clone the response to read it without consuming it
      const contentType = response.headers.get("content-type");
      if (contentType && typeof contentType === "string" && contentType.includes("application/json")) {
        const body = await response.json();
        if (body && typeof body === "object") {
          errorMessage = body.error || body.message || errorMessage;
        }
      } else {
        // Try to get text if not JSON
        const text = await response.text();
        if (text && text.length > 0) {
          errorMessage = text;
        }
      }
    } catch (parseError) {
      // If we can't parse the response, use the status message
      console.error("Error parsing error response:", parseError);
      errorMessage = `Request failed: ${response.status} ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  try {
    return await response.json();
  } catch (parseError) {
    throw new Error(`Invalid JSON response from server: ${parseError.message}`);
  }
}

/**
 * Products API
 */
export const productsApi = {
  /**
   * Get all products with optional filters
   * @param {Object} filters - Optional filters (category, inStock, search, sortBy)
   * @returns {Promise<Array>} Array of products
   */
  getAll: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.category) params.append("category", filters.category);
    if (filters.inStock !== undefined) params.append("inStock", filters.inStock);
    if (filters.search) params.append("search", filters.search);
    if (filters.sortBy) params.append("sortBy", filters.sortBy);

    const queryString = params.toString();
    const url = `/api/products${queryString ? `?${queryString}` : ""}`;
    const result = await fetchJson(url);
    return result.data || [];
  },

  /**
   * Get a single product by ID
   * @param {string} id - Product ID
   * @returns {Promise<Object>} Product object
   */
  getById: async (id) => {
    const result = await fetchJson(`/api/products/${id}`);
    return result.data;
  },
};

/**
 * Menu API
 */
export const menuApi = {
  /**
   * Get all menu items with optional filters
   * @param {Object} filters - Optional filters (section, available, search)
   * @returns {Promise<Array>} Array of menu items
   */
  getAll: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.section) params.append("section", filters.section);
    if (filters.available !== undefined) params.append("available", filters.available);
    if (filters.search) params.append("search", filters.search);

    const queryString = params.toString();
    const url = `/api/menu${queryString ? `?${queryString}` : ""}`;
    const result = await fetchJson(url);
    return result.data || [];
  },

  /**
   * Get a single menu item by ID
   * @param {string} id - Menu item ID
   * @returns {Promise<Object>} Menu item object
   */
  getById: async (id) => {
    const result = await fetchJson(`/api/menu/${id}`);
    return result.data;
  },

  /**
   * Get all available modifier groups
   * @returns {Promise<Array>} Array of modifier groups
   */
  getModifierGroups: async () => {
    const result = await fetchJson("/api/menu/modifier-groups");
    return result.data || [];
  },
};

/**
 * Location API
 */
export const locationApi = {
  /**
   * Get store location information
   * @returns {Promise<Object>} Location object with address, hours, coordinates
   */
  getLocation: async () => {
    const result = await fetchJson("/api/location");
    return result.data;
  },

  /**
   * Calculate distance from user coordinates to store
   * @param {Object} coords - User coordinates { lat, lng }
   * @returns {Promise<Object>} Distance object with miles and km
   */
  calculateDistance: async (coords) => {
    const result = await fetchJson("/api/location/distance", {
      method: "POST",
      body: JSON.stringify(coords),
    });
    return result.data.distance;
  },
};

/**
 * Orders API
 */
export const ordersApi = {
  /**
   * Create a new order
   * @param {Object} orderData - Order data (customer, items, pickupTime, etc.)
   * @returns {Promise<Object>} Created order object
   */
  create: async (orderData) => {
    const result = await fetchJson("/api/orders", {
      method: "POST",
      body: JSON.stringify(orderData),
    });
    return result.data;
  },

  /**
   * Recover order after Hosted Checkout if sessionStorage was lost (same checkoutId from URL).
   */
  recoverHostedCheckout: async (checkoutId) => {
    const result = await fetchJson("/api/orders/recover-hosted-checkout", {
      method: "POST",
      body: JSON.stringify({ checkoutId }),
    });
    return result.data;
  },

  /**
   * Kitchen admin: create paid order from hosted-checkout draft, skipping pickup-time and
   * online-only menu checks (stale pickup / recovery failures).
   */
  forceResolveHostedCheckout: async (checkoutId) => {
    const result = await fetchJson("/api/orders/kitchen/force-resolve-hosted-checkout", {
      method: "POST",
      body: JSON.stringify({ checkoutId }),
    });
    return result.data;
  },

  /**
   * Get an order by ID
   * @param {string} id - Order ID
   * @returns {Promise<Object>} Order object
   */
  getById: async (id) => {
    const result = await fetchJson(`/api/orders/${id}`);
    return result.data;
  },

  /**
   * Update order status
   * @param {string} id - Order ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated order object
   */
  /**
   * @param {string} id
   * @param {string|{status?: string, paymentStatus?: string}} statusOrBody - legacy: status string; or body object
   */
  updateStatus: async (id, statusOrBody) => {
    const body =
      typeof statusOrBody === "string"
        ? { status: statusOrBody }
        : statusOrBody;
    const result = await fetchJson(`/api/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return result.data;
  },

  /**
   * Get orders for kitchen dashboard
   * @returns {Promise<Array>} Array of orders
   */
  getKitchenOrders: async () => {
    const result = await fetchJson("/api/orders/kitchen");
    return result.data || [];
  },

  /**
   * Get previous (completed) orders for kitchen dashboard
   * @param {string} startDate - Start of range (YYYY-MM-DD)
   * @param {string} endDate - End of range (YYYY-MM-DD)
   * @param {boolean} all - If true, return all completed orders regardless of date
   * @returns {Promise<Array>} Array of completed orders
   */
  getPreviousKitchenOrders: async (startDate = null, endDate = null, all = false) => {
    const params = new URLSearchParams();
    if (all) {
      params.append("all", "true");
    } else if (startDate && endDate) {
      const { rangeStart, rangeEnd } = localDateRangeToUtcIsoBounds(
        startDate,
        endDate,
      );
      params.append("rangeStart", rangeStart);
      params.append("rangeEnd", rangeEnd);
      params.append("startDate", startDate);
      params.append("endDate", endDate);
    } else if (startDate) {
      const { rangeStart, rangeEnd } = localDateRangeToUtcIsoBounds(
        startDate,
        startDate,
      );
      params.append("rangeStart", rangeStart);
      params.append("rangeEnd", rangeEnd);
      params.append("date", startDate);
    }
    const queryString = params.toString();
    const url = `/api/orders/kitchen/previous${queryString ? `?${queryString}` : ""}`;
    const result = await fetchJson(url);
    return result.data || [];
  },

  /**
   * Kitchen dashboard: paid checkout drafts needing attention (with orderDraft for tickets).
   */
  getKitchenCheckoutAlerts: async () => {
    const result = await fetchJson("/api/orders/kitchen/checkout-alerts");
    return result.data || [];
  },
};

/**
 * Bean Stamps loyalty (authenticated users only)
 */
export const loyaltyApi = {
  getMe: async () => {
    const result = await fetchJson("/api/loyalty/me");
    return result.data;
  },
};

/**
 * Auth API
 */
export const authApi = {
  /**
   * Sign up a new user
   * @param {Object} userData - User data (firstName, lastName, email, password, confirmPassword, phone)
   * @returns {Promise<Object>} User object and token
   */
  signUp: async (userData) => {
    const result = await fetchJson("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(userData),
    });
    return result.data;
  },

  /**
   * Sign in with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} User object and token
   */
  signIn: async (email, password) => {
    const result = await fetchJson("/api/auth/signin", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    return result.data;
  },

  /**
   * Sign out current user
   * @returns {Promise<void>}
   */
  signOut: async () => {
    await fetchJson("/api/auth/signout", {
      method: "POST",
    });
    // Clear local storage
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
  },

  /**
   * Get current user information
   * @returns {Promise<Object>} User object
   */
  getMe: async () => {
    const result = await fetchJson("/api/auth/me");
    return result.data.user;
  },

  /**
   * Get current user's orders
   * @returns {Promise<Array>} Array of user orders
   */
  getUserOrders: async () => {
    const result = await fetchJson("/api/auth/orders");
    return result.data.orders || [];
  },
};

/**
 * Payments API
 */
export const paymentsApi = {
  /**
   * Create a Hosted Checkout session
   * @param {Object} checkoutData - Checkout data (items, customer, amount, URLs, etc.)
   * @returns {Promise<Object>} Checkout session with URL
   */
  createCheckout: async (checkoutData) => {
    const result = await fetchJson("/api/payments/create-checkout", {
      method: "POST",
      body: JSON.stringify(checkoutData),
    });
    return result.data;
  },
};

