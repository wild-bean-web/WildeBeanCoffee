// Jest globals are available without import in ES modules
import request from "supertest";
import { createTestApp } from "./app.js";
import { setupTestDB, teardownTestDB, clearDatabase } from "./setup.js";
import { createTestProduct } from "./helpers.js";

const app = createTestApp();

describe("Products API", () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  describe("GET /api/products", () => {
    it("should return empty array when no products exist", async () => {
      const response = await request(app).get("/api/products");
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("data");
      expect(response.body.data).toEqual([]);
    });

    it("should return all active products", async () => {
      const product1 = await createTestProduct({ name: "Product 1", active: true });
      const product2 = await createTestProduct({ name: "Product 2", active: true });
      const product3 = await createTestProduct({ name: "Inactive Product", active: false });

      // Ensure products are saved
      expect(product1._id).toBeDefined();
      expect(product2._id).toBeDefined();
      expect(product3._id).toBeDefined();

      // Verify data exists in database
      const { Product } = await import("../models/index.js");
      const count = await Product.countDocuments({ active: true });
      expect(count).toBe(2);

      const response = await request(app).get("/api/products");
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((p) => p.active === true)).toBe(true);
    });

    it("should filter by category", async () => {
      const p1 = await createTestProduct({ name: "Product 1", categories: ["arabica"], active: true });
      const p2 = await createTestProduct({ name: "Product 2", categories: ["robusta"], active: true });
      const p3 = await createTestProduct({ name: "Product 3", categories: ["arabica", "premium"], active: true });

      expect(p1._id).toBeDefined();
      expect(p2._id).toBeDefined();
      expect(p3._id).toBeDefined();

      const response = await request(app).get("/api/products?category=arabica");
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((p) => p.categories.includes("arabica"))).toBe(true);
    });

    it("should filter by inStock", async () => {
      const inStock = await createTestProduct({ name: "In Stock", inStock: true, active: true });
      const outOfStock = await createTestProduct({ name: "Out of Stock", inStock: false, active: true });

      expect(inStock._id).toBeDefined();
      expect(outOfStock._id).toBeDefined();

      const response = await request(app).get("/api/products?inStock=true");
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].inStock).toBe(true);
    });

    it("should search by name", async () => {
      const p1 = await createTestProduct({ name: "Ethiopian Yirgacheffe", active: true });
      const p2 = await createTestProduct({ name: "Colombian Supremo", active: true });
      const p3 = await createTestProduct({ name: "Ethiopian Sidamo", active: true });

      expect(p1._id).toBeDefined();
      expect(p2._id).toBeDefined();
      expect(p3._id).toBeDefined();

      const response = await request(app).get("/api/products?search=Ethiopia");
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((p) => p.name.includes("Ethiopian"))).toBe(true);
    });

    it("should return 404 for invalid product ID", async () => {
      const invalidId = "507f1f77bcf86cd799439011";
      const response = await request(app).get(`/api/products/${invalidId}`);
      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/products/:id", () => {
    it("should return a single product by ID", async () => {
      const product = await createTestProduct({ name: "Test Product" });

      const response = await request(app).get(`/api/products/${product._id}`);
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty("_id", product._id.toString());
      expect(response.body.data.name).toBe("Test Product");
    });

    it("should return 400 for invalid ObjectId format", async () => {
      const response = await request(app).get("/api/products/invalid-id");
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });
  });
});

