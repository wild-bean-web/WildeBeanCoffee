import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import productRoutes from "./routes/products.js";
import menuRoutes from "./routes/menu.js";
import orderRoutes from "./routes/orders.js";
import locationRoutes from "./routes/location.js";
import authRoutes from "./routes/auth.js";
import paymentRoutes from "./routes/payments.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
const rawOrigin = process.env.CORS_ORIGIN;
// Default to localhost:3000 for development if CORS_ORIGIN is not set
const corsOrigin =
  rawOrigin && rawOrigin.length > 0
    ? rawOrigin.split(",").map((o) => o.trim())
    : ["http://localhost:3000"];
const mongoUri = process.env.MONGODB_URI;
const dbState = {
  status: "disconnected",
  lastError: null,
  lastConnectedAt: null,
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connectWithRetry(attempt = 1) {
  if (!mongoUri) {
    dbState.status = "not_configured";
    console.warn("MONGODB_URI not set; skipping DB connection");
    return;
  }

  const maxAttempts = Number(process.env.MONGO_MAX_RETRIES ?? 5);
  const baseDelay = Number(process.env.MONGO_RETRY_DELAY_MS ?? 1000);
  const backoff = Math.min(baseDelay * 2 ** (attempt - 1), 10000);

  try {
    dbState.status = "connecting";
    await mongoose.connect(mongoUri);
    dbState.status = "connected";
    dbState.lastError = null;
    dbState.lastConnectedAt = new Date().toISOString();
    console.log("Connected to MongoDB");
  } catch (err) {
    dbState.status = "error";
    dbState.lastError = err.message;
    console.error(`MongoDB connection attempt ${attempt} failed:`, err.message);

    if (attempt < maxAttempts) {
      console.log(`Retrying MongoDB in ${backoff}ms...`);
      await delay(backoff);
      return connectWithRetry(attempt + 1);
    }

    console.error("Max MongoDB connection attempts exceeded.");
  }
}

mongoose.connection.on("disconnected", () => {
  if (dbState.status !== "not_configured") {
    dbState.status = "disconnected";
    console.warn("MongoDB disconnected");
  }
});

mongoose.connection.on("error", (err) => {
  dbState.status = "error";
  dbState.lastError = err.message;
});

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Check if origin is in allowed list
      const allowedOrigins = Array.isArray(corsOrigin) ? corsOrigin : [corsOrigin];
      if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // Allow credentials for authenticated requests
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use("/api/products", productRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/payments", paymentRoutes);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    db: {
      status: dbState.status,
      lastConnectedAt: dbState.lastConnectedAt,
      lastError: dbState.lastError,
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.originalUrl });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || "Internal Server Error",
  });
});

app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
  connectWithRetry();
});

const gracefulShutdown = async () => {
  await mongoose.connection.close();
  process.exit(0);
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
