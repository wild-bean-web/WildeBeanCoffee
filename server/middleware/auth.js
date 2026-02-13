import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import { errorResponse } from "../utils/validation.js";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to req.user
 */
export async function authenticate(req, res, next) {
  try {
    // Get token from Authorization header or cookie
    let token = null;
    
    // Check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
    
    // Check cookie if no header token
    if (!token && req.cookies) {
      token = req.cookies.token;
    }
    
    if (!token) {
      return errorResponse(res, 401, "Authentication required");
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return errorResponse(res, 401, "User not found");
    }
    
    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return errorResponse(res, 401, "Invalid or expired token");
    }
    return errorResponse(res, 500, "Authentication error", error.message);
  }
}

/**
 * Authenticate allowing token from query (for EventSource/SSE which can't send headers)
 * Checks req.query.token first, then Authorization header, then cookie.
 */
export async function authenticateWithQueryToken(req, res, next) {
  try {
    let token = null;
    if (req.query && req.query.token) {
      token = req.query.token;
    }
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.substring(7);
    }
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }
    if (!token) {
      return errorResponse(res, 401, "Authentication required");
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return errorResponse(res, 401, "User not found");
    }
    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return errorResponse(res, 401, "Invalid or expired token");
    }
    return errorResponse(res, 500, "Authentication error", error.message);
  }
}

/**
 * Optional authentication middleware
 * Sets req.user if token is valid, but doesn't fail if no token (for guest access)
 */
export async function optionalAuth(req, res, next) {
  try {
    // Get token from Authorization header or cookie
    let token = null;
    
    // Check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
    
    // Check cookie if no header token
    if (!token && req.cookies) {
      token = req.cookies.token;
    }
    
    // If no token, continue without setting req.user (guest access)
    if (!token) {
      return next();
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Get user from database
      const user = await User.findById(decoded.userId || decoded.id).select("-password");
      if (user) {
        // Attach user to request
        req.user = user;
      }
    } catch (tokenError) {
      // Invalid token, but continue as guest (don't fail the request)
      // Token errors are silently ignored for optional auth
    }
    
    next();
  } catch (error) {
    // Any other errors, continue as guest
    next();
  }
}

/**
 * Generate JWT token for user
 * @param {string} userId - User ID
 * @returns {string} JWT token
 */
export function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

