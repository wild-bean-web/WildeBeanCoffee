/**
 * Test utilities for React components
 */
import { render } from "@testing-library/react";
import { jest } from "@jest/globals";

/**
 * Custom render function that includes providers
 */
export function renderWithProviders(ui, { ...renderOptions } = {}) {
  // Add any providers here if needed (e.g., ThemeProvider, RouterProvider)
  return render(ui, { ...renderOptions });
}

/**
 * Mock cart data
 */
export const mockCartItem = {
  _id: "test-id-1",
  name: "Test Product",
  price: 15.99,
  quantity: 1,
  itemType: "product",
  image: "/images/test.jpg",
};

export const mockCart = [mockCartItem];

/**
 * Mock product data
 */
export const mockProduct = {
  _id: "product-1",
  name: "Ethiopia Yirgacheffe",
  description: "A delicious coffee",
  price: 16.5,
  currency: "USD",
  roastLevel: "Light",
  origin: "Ethiopia",
  flavorNotes: ["Floral", "Citrus"],
  inStock: true,
  inventory: 40,
  images: ["/images/products/test.jpg"],
  categories: ["single-origin", "light-roast"],
  active: true,
};

/**
 * Mock menu item data
 */
export const mockMenuItem = {
  _id: "menu-1",
  name: "Latte",
  description: "Espresso with steamed milk",
  price: 4.89,
  currency: "USD",
  section: "Coffee & Espresso",
  tags: ["hot", "espresso", "milk"],
  allergens: ["Lactose"],
  image: "/images/menu/Coffee/Latte.png",
  available: true,
  active: true,
};

/**
 * Mock location data
 */
export const mockLocation = {
  _id: "location-1",
  name: "Wild Bean Coffee",
  address1: "1532 Rockville Pike",
  city: "Rockville",
  state: "MD",
  postalCode: "20852",
  country: "US",
  coordinates: { lat: 39.0834, lng: -77.1533 },
  phone: "555-555-1234",
  email: "hello@wildbeancoffee.com",
  hours: [
    { day: "Monday", opens: "06:00", closes: "19:00" },
    { day: "Tuesday", opens: "06:00", closes: "19:00" },
  ],
  active: true,
};

/**
 * Mock API responses
 */
export const mockApiResponse = {
  products: {
    data: [mockProduct],
  },
  menu: {
    data: [mockMenuItem],
  },
  location: {
    data: mockLocation,
  },
};

/**
 * Helper to mock fetch
 */
export function mockFetch(data, ok = true, status = 200) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok,
      status,
      json: () => Promise.resolve(data),
    })
  );
}

/**
 * Helper to mock localStorage
 */
export function mockLocalStorage() {
  const store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach((key) => delete store[key]);
    }),
  };
}

// Re-export everything from testing-library
export * from "@testing-library/react";
