// Jest globals are available without import in ES modules
import request from "supertest";
import { createTestApp } from "./app.js";
import { setupTestDB, teardownTestDB, clearDatabase } from "./setup.js";
import { createTestMenuItem } from "./helpers.js";

const app = createTestApp();

describe("Menu API", () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  describe("GET /api/menu", () => {
    it("should return empty array when no menu items exist", async () => {
      const response = await request(app).get("/api/menu");
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("data");
      expect(response.body.data).toEqual([]);
    });

    it("should return all active menu items", async () => {
      const item1 = await createTestMenuItem({ name: "Latte", active: true });
      const item2 = await createTestMenuItem({ name: "Cappuccino", active: true });
      const item3 = await createTestMenuItem({ name: "Inactive Item", active: false });

      expect(item1._id).toBeDefined();
      expect(item2._id).toBeDefined();
      expect(item3._id).toBeDefined();

      const response = await request(app).get("/api/menu");
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((item) => item.active === true)).toBe(true);
    });

    it("should filter by section", async () => {
      const item1 = await createTestMenuItem({ name: "Latte", section: "Coffee", active: true });
      const item2 = await createTestMenuItem({ name: "Croissant", section: "Bakery", active: true });
      const item3 = await createTestMenuItem({ name: "Cappuccino", section: "Coffee", active: true });

      expect(item1._id).toBeDefined();
      expect(item2._id).toBeDefined();
      expect(item3._id).toBeDefined();

      const response = await request(app).get("/api/menu?section=Coffee");
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((item) => item.section === "Coffee")).toBe(true);
    });

    it("should filter by available", async () => {
      await createTestMenuItem({ name: "Available Item", available: true });
      await createTestMenuItem({ name: "Unavailable Item", available: false });

      const response = await request(app).get("/api/menu?available=true");
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].available).toBe(true);
    });

    it("should omit customer-hidden menu items from list", async () => {
      await createTestMenuItem({ name: "Almond Croissant", active: true });
      await createTestMenuItem({ name: "Plain Croissant", active: true });

      const response = await request(app).get("/api/menu");
      expect(response.status).toBe(200);
      const names = response.body.data.map((i) => i.name);
      expect(names).not.toContain("Almond Croissant");
      expect(names).toContain("Plain Croissant");
    });

    it("should search by name", async () => {
      const item1 = await createTestMenuItem({ name: "Iced Latte", active: true });
      const item2 = await createTestMenuItem({ name: "Hot Latte", active: true });
      const item3 = await createTestMenuItem({ 
        name: "Cappuccino", 
        description: "Espresso with foam", // Different description to avoid matching "latte"
        active: true 
      });

      expect(item1._id).toBeDefined();
      expect(item2._id).toBeDefined();
      expect(item3._id).toBeDefined();

      const response = await request(app).get("/api/menu?search=Latte");
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((item) => item.name.includes("Latte"))).toBe(true);
    });
  });

  describe("GET /api/menu/:id", () => {
    it("should return a single menu item by ID", async () => {
      const menuItem = await createTestMenuItem({ name: "Test Latte" });

      const response = await request(app).get(`/api/menu/${menuItem._id}`);
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty("_id", menuItem._id.toString());
      expect(response.body.data.name).toBe("Test Latte");
    });

    it("should return 404 for customer-hidden menu item by id", async () => {
      const menuItem = await createTestMenuItem({
        name: "Almond Croissant",
        active: true,
      });
      const response = await request(app).get(`/api/menu/${menuItem._id}`);
      expect(response.status).toBe(404);
    });

    it("should return 404 for invalid menu item ID", async () => {
      const invalidId = "507f1f77bcf86cd799439011";
      const response = await request(app).get(`/api/menu/${invalidId}`);
      expect(response.status).toBe(404);
    });

    it("should return 400 for invalid ObjectId format", async () => {
      const response = await request(app).get("/api/menu/invalid-id");
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });
  });
});

