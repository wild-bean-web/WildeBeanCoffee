/**
 * Create Express app instance for testing
 * This allows us to test routes without starting the server
 */
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import productRoutes from "../routes/products.js";
import menuRoutes from "../routes/menu.js";
import menuAdminRoutes from "../routes/menuAdmin.js";
import orderRoutes from "../routes/orders.js";
import locationRoutes from "../routes/location.js";
import specialsRoutes from "../routes/specials.js";

export function createTestApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: "*" }));
  app.use(express.json());
  app.use(morgan("test"));

  app.use("/api/products", productRoutes);
  app.use("/api/menu", menuRoutes);
  app.use("/api/menu/admin", menuAdminRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/location", locationRoutes);
  app.use("/api/specials", specialsRoutes);

  // Error handler
  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    res.status(status).json({
      error: err.message || "Internal Server Error",
    });
  });

  return app;
}

