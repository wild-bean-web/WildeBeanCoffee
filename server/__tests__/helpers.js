/**
 * Test helper functions
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { Product, MenuItem, Order, Location, User } from "../models/index.js";
import { generateToken } from "../middleware/auth.js";

/**
 * Create a test product
 */
export async function createTestProduct(overrides = {}) {
  return await Product.create({
    name: "Test Coffee",
    description: "A test coffee product",
    price: 15.99,
    currency: "USD",
    roastLevel: "Medium",
    origin: "Test Origin",
    flavorNotes: ["Chocolate", "Caramel"],
    inStock: true,
    inventory: 50,
    images: ["/images/test.jpg"],
    categories: ["test-category"],
    active: true,
    ...overrides,
  });
}

/**
 * Create a test menu item
 */
export async function createTestMenuItem(overrides = {}) {
  return await MenuItem.create({
    name: "Test Latte",
    description: "A test latte",
    price: 5.99,
    currency: "USD",
    section: "Coffee",
    tags: ["hot", "dairy"],
    allergens: ["Milk"],
    available: true,
    image: "/images/test-Latte.png",
    active: true,
    ...overrides,
  });
}

/**
 * Create a test order
 */
export async function createTestOrder(overrides = {}) {
  return await Order.create({
    customer: {
      name: "Test Customer",
      phone: "555-123-4567",
      email: "test@example.com",
    },
    items: [
      {
        itemType: "menu",
        itemId: new mongoose.Types.ObjectId(),
        name: "Test Item",
        price: 5.99,
        quantity: 1,
      },
    ],
    status: "placed",
    paymentStatus: "pending",
    totals: {
      subtotal: 5.99,
      tax: 0.52,
      total: 6.51,
      currency: "USD",
    },
    pickupTime: new Date(Date.now() + 3600000), // 1 hour from now
    ...overrides,
  });
}

/**
 * Create a test location
 */
const ALL_STORE_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function buildPaidOrderFields(paymentRef = `test-payment-${Date.now()}`) {
  return {
    paymentStatus: "paid",
    paymentRef,
  };
}

/** Pickup ~24h ahead at 2 PM local — stays inside test store hours (6 AM–11 PM). */
export function futurePickupWithinStoreHours() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(14, 0, 0, 0);
  return d.toISOString();
}

/** Kitchen admin user + Bearer token for protected order routes. */
export async function createTestKitchenAdmin(overrides = {}) {
  const email = overrides.email || "danielwoldehana@yahoo.com";
  const user = await User.create({
    firstName: "Test",
    lastName: "Admin",
    email,
    phone: "555-000-0000",
    password: await bcrypt.hash("testpassword", 10),
    ...overrides,
  });
  const token = generateToken(user._id.toString());
  return { user, authHeader: `Bearer ${token}` };
}

export async function createTestLocation(overrides = {}) {
  return await Location.create({
    name: "Test Location",
    address1: "123 Test St",
    city: "Test City",
    state: "TS",
    postalCode: "12345",
    country: "USA",
    coordinates: {
      lat: 39.0834,
      lng: -77.1533,
    },
    phone: "555-123-4567",
    email: "test@wildbeancoffee.com",
    hours: ALL_STORE_DAYS.map((day) => ({
      day,
      opens: "06:00",
      closes: "23:00",
      closed: false,
    })),
    active: true,
    onlineOrderingPaused: false,
    ...overrides,
  });
}
