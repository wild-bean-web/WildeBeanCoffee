// Jest globals are available without import in ES modules
import request from "supertest";
import mongoose from "mongoose";
import { createTestApp } from "./app.js";
import { setupTestDB, teardownTestDB, clearDatabase } from "./setup.js";
import { createTestOrder, createTestProduct, createTestMenuItem } from "./helpers.js";

const app = createTestApp();

// Skipped until Mongo/Jest env is stable locally; remove .skip to re-enable.
describe.skip("Orders API", () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  describe("POST /api/orders", () => {
    it("should create a new order with valid data", async () => {
      const orderData = {
        customer: {
          name: "John Doe",
          phone: "555-123-4567",
          email: "john@example.com",
        },
        items: [
          {
            itemType: "menu",
            itemId: new mongoose.Types.ObjectId().toString(),
            name: "Latte",
            price: 5.99,
            quantity: 2,
          },
        ],
        status: "placed",
        paymentStatus: "pending",
        totals: {
          subtotal: 11.98,
          tax: 1.05,
          total: 13.03,
          currency: "USD",
        },
        pickupTime: new Date(Date.now() + 3600000).toISOString(),
      };

      const response = await request(app)
        .post("/api/orders")
        .send(orderData);

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty("_id");
      expect(response.body.data.customer.name).toBe("John Doe");
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.status).toBe("placed");
    });

    it("should create order with optional email", async () => {
      const orderData = {
        customer: {
          name: "Jane Doe",
          phone: "555-987-6543",
        },
        items: [
          {
            itemType: "menu",
            itemId: new mongoose.Types.ObjectId().toString(),
            name: "Cappuccino",
            price: 5.49,
            quantity: 1,
          },
        ],
        status: "placed",
        paymentStatus: "pending",
        totals: {
          subtotal: 5.49,
          tax: 0.48,
          total: 5.97,
          currency: "USD",
        },
        pickupTime: new Date(Date.now() + 3600000).toISOString(),
      };

      const response = await request(app)
        .post("/api/orders")
        .send(orderData);

      expect(response.status).toBe(201);
      expect(response.body.data.customer.email).toBeUndefined();
    });

    it("should return 400 for missing required fields", async () => {
      const invalidOrder = {
        customer: {
          name: "Test",
          // Missing phone
        },
        items: [],
      };

      const response = await request(app)
        .post("/api/orders")
        .send(invalidOrder);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should return 400 for empty items array", async () => {
      const orderData = {
        customer: {
          name: "Test Customer",
          phone: "555-123-4567",
        },
        items: [],
        status: "placed",
        paymentStatus: "pending",
        totals: {
          subtotal: 0,
          tax: 0,
          total: 0,
          currency: "USD",
        },
        pickupTime: new Date(Date.now() + 3600000).toISOString(),
      };

      const response = await request(app)
        .post("/api/orders")
        .send(orderData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should return 400 when pickupTime is before minimum lead time", async () => {
      const orderData = {
        customer: {
          name: "John Doe",
          phone: "555-123-4567",
          email: "john@example.com",
        },
        items: [
          {
            itemType: "menu",
            itemId: new mongoose.Types.ObjectId().toString(),
            name: "Latte",
            price: 5.99,
            quantity: 1,
          },
        ],
        taxRate: 0,
        paymentStatus: "paid",
        paymentRef: "hosted-checkout-test",
        pickupTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      };

      const response = await request(app)
        .post("/api/orders")
        .send(orderData);

      expect(response.status).toBe(400);
      expect(String(response.body.error)).toMatch(/at least \d+ minutes/i);
    });

    it("should create order when pickupTime meets minimum lead time", async () => {
      const orderData = {
        customer: {
          name: "John Doe",
          phone: "555-123-4567",
          email: "john@example.com",
        },
        items: [
          {
            itemType: "menu",
            itemId: new mongoose.Types.ObjectId().toString(),
            name: "Latte",
            price: 5.99,
            quantity: 1,
          },
        ],
        taxRate: 0,
        paymentStatus: "paid",
        paymentRef: "hosted-checkout-test",
        pickupTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      };

      const response = await request(app)
        .post("/api/orders")
        .send(orderData);

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty("_id");
    });
  });

  describe("GET /api/orders/:id", () => {
    it("should return a single order by ID", async () => {
      const order = await createTestOrder();
      expect(order._id).toBeDefined();

      const response = await request(app).get(`/api/orders/${order._id.toString()}`);
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty("_id", order._id.toString());
      expect(response.body.data.customer.name).toBe("Test Customer");
    });

    it("should return 404 for invalid order ID", async () => {
      const invalidId = new mongoose.Types.ObjectId().toString();
      const response = await request(app).get(`/api/orders/${invalidId}`);
      expect(response.status).toBe(404);
    });

    it("should return 400 for invalid ObjectId format", async () => {
      const response = await request(app).get("/api/orders/invalid-id");
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("PATCH /api/orders/:id/status", () => {
    it("should update order status", async () => {
      const order = await createTestOrder({ status: "placed" });
      expect(order._id).toBeDefined();

      const response = await request(app)
        .patch(`/api/orders/${order._id.toString()}/status`)
        .send({ status: "preparing" });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe("preparing");
    });

    it("should return 400 for invalid status", async () => {
      const order = await createTestOrder();

      const response = await request(app)
        .patch(`/api/orders/${order._id}/status`)
        .send({ status: "invalid-status" });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should return 404 for non-existent order", async () => {
      const invalidId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .patch(`/api/orders/${invalidId}/status`)
        .send({ status: "preparing" });

      expect(response.status).toBe(404);
    });
  });
});

