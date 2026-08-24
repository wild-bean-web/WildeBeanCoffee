// Jest globals are available without import in ES modules
import request from "supertest";
import bcrypt from "bcryptjs";
import { createTestApp } from "./app.js";
import { setupTestDB, teardownTestDB, clearDatabase } from "./setup.js";
import {
  createTestKitchenAdmin,
  createTestMenuItem,
} from "./helpers.js";
import { User } from "../models/index.js";
import { generateToken } from "../middleware/auth.js";

const app = createTestApp();

async function createNonAdminUser() {
  const user = await User.create({
    firstName: "Regular",
    lastName: "User",
    email: "customer@example.com",
    phone: "555-111-2222",
    password: await bcrypt.hash("password", 10),
  });
  return {
    user,
    authHeader: `Bearer ${generateToken(user._id.toString())}`,
  };
}

describe("Menu Admin Availability API", () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  it("rejects unauthenticated requests", async () => {
    const response = await request(app).get("/api/menu/admin/ingredients");
    expect(response.status).toBe(401);
  });

  it("rejects non-admin users", async () => {
    const { authHeader } = await createNonAdminUser();
    const response = await request(app)
      .get("/api/menu/admin/ingredients")
      .set("Authorization", authHeader);
    expect(response.status).toBe(403);
  });

  it("lists recipe ingredients only (not modifier add-ons)", async () => {
    const { authHeader } = await createTestKitchenAdmin();
    await createTestMenuItem({
      name: "Green Glow",
      recipeIngredients: ["Spinach", "Kale", "Banana"],
    });
    await createTestMenuItem({
      name: "Iced Latte",
      recipeIngredients: ["Espresso", "Whole Milk"],
    });

    const response = await request(app)
      .get("/api/menu/admin/ingredients?search=spinach")
      .set("Authorization", authHeader);

    expect(response.status).toBe(200);
    const names = response.body.data.map((entry) => entry.name);
    expect(names).toEqual(["Spinach"]);
  });

  it("searches menu items by name and ingredients together", async () => {
    const { authHeader } = await createTestKitchenAdmin();
    await createTestMenuItem({
      name: "Green Glow",
      recipeIngredients: ["Spinach", "Kale", "Banana"],
    });
    await createTestMenuItem({
      name: "Iced Latte",
      recipeIngredients: ["Espresso", "Whole Milk"],
    });

    const response = await request(app)
      .get("/api/menu/admin/search?search=green+glow")
      .set("Authorization", authHeader);

    expect(response.status).toBe(200);
    expect(response.body.data.menuItems).toHaveLength(1);
    expect(response.body.data.menuItems[0].name).toBe("Green Glow");
    expect(response.body.data.ingredients).toEqual([]);
  });

  it("finds menu items and ingredients with fuzzy search typos", async () => {
    const { authHeader } = await createTestKitchenAdmin();
    await createTestMenuItem({
      name: "Green Glow",
      recipeIngredients: ["Spinach", "Kale", "Banana"],
    });
    await createTestMenuItem({
      name: "Iced Latte",
      recipeIngredients: ["Espresso", "Whole Milk"],
    });

    const itemSearch = await request(app)
      .get("/api/menu/admin/search?search=greem+glo")
      .set("Authorization", authHeader);
    expect(itemSearch.status).toBe(200);
    expect(itemSearch.body.data.menuItems).toHaveLength(1);
    expect(itemSearch.body.data.menuItems[0].name).toBe("Green Glow");

    const ingredientSearch = await request(app)
      .get("/api/menu/admin/search?search=spnach")
      .set("Authorization", authHeader);
    expect(ingredientSearch.status).toBe(200);
    expect(ingredientSearch.body.data.ingredients.map((e) => e.name)).toEqual([
      "Spinach",
    ]);
  });

  it("lists all currently unavailable menu items", async () => {
    const { authHeader } = await createTestKitchenAdmin();
    const outItem = await createTestMenuItem({
      name: "Green Glow",
      available: false,
    });
    await createTestMenuItem({
      name: "Iced Latte",
      available: true,
    });

    const response = await request(app)
      .get("/api/menu/admin/unavailable")
      .set("Authorization", authHeader);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].name).toBe("Green Glow");
    expect(response.body.data[0]._id).toBe(outItem._id.toString());
    expect(response.body.data[0].available).toBe(false);
  });

  it("finds dependents for spinach (Green Glow only)", async () => {
    const { authHeader } = await createTestKitchenAdmin();
    const greenGlow = await createTestMenuItem({
      name: "Green Glow",
      recipeIngredients: ["Spinach", "Kale", "Banana"],
      available: true,
    });
    await createTestMenuItem({
      name: "Iced Latte",
      recipeIngredients: ["Espresso", "Whole Milk"],
      available: true,
    });

    const response = await request(app)
      .get("/api/menu/admin/dependents?ingredient=Spinach")
      .set("Authorization", authHeader);

    expect(response.status).toBe(200);
    expect(response.body.data.canonicalIngredient).toBe("Spinach");
    expect(response.body.data.menuItems).toHaveLength(1);
    expect(response.body.data.menuItems[0].name).toBe("Green Glow");
    expect(response.body.data.menuItems[0]._id).toBe(greenGlow._id.toString());
  });

  it("toggles a menu item in/out of stock", async () => {
    const { authHeader } = await createTestKitchenAdmin();
    const item = await createTestMenuItem({ available: true });

    const disable = await request(app)
      .patch(`/api/menu/admin/items/${item._id}/available`)
      .set("Authorization", authHeader)
      .send({ available: false });
    expect(disable.status).toBe(200);
    expect(disable.body.data.available).toBe(false);

    const enable = await request(app)
      .patch(`/api/menu/admin/items/${item._id}/available`)
      .set("Authorization", authHeader)
      .send({ available: true });
    expect(enable.status).toBe(200);
    expect(enable.body.data.available).toBe(true);
  });

  it("bulk toggles menu item stock", async () => {
    const { authHeader } = await createTestKitchenAdmin();
    const item1 = await createTestMenuItem({ name: "Item One" });
    const item2 = await createTestMenuItem({ name: "Item Two" });

    const response = await request(app)
      .patch("/api/menu/admin/items/bulk-available")
      .set("Authorization", authHeader)
      .send({
        itemIds: [item1._id.toString(), item2._id.toString()],
        available: false,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.modifiedCount).toBe(2);
    expect(
      response.body.data.items.every((item) => item.available === false),
    ).toBe(true);
  });
});
