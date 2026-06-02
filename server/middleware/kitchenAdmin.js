import { errorResponse } from "../utils/validation.js";
import { isKitchenAdminEmail } from "../config/kitchenAdmins.js";

export function requireKitchenAdmin(req, res, next) {
  if (!req.user) {
    return errorResponse(res, 401, "Authentication required");
  }
  if (!isKitchenAdminEmail(req.user.email)) {
    return errorResponse(
      res,
      403,
      "Access denied. Kitchen dashboard is restricted to authorized users.",
    );
  }
  next();
}
