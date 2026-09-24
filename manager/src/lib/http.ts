import { CloverApiError, CloverConfigError } from "@/integrations/clover";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { IllegalDocumentTransitionError } from "@/domain/documents";
import { ManagerAuthError } from "@/lib/auth/session";
import { DocumentServiceError } from "@/services/documents/errors";
import { ImportServiceError } from "@/services/imports/errors";
import { InventoryServiceError } from "@/services/inventory/errors";
import { LocationScopeError } from "@/services/locations/errors";
import { PayrollServiceError } from "@/services/payroll/errors";
import { SalesServiceError } from "@/services/sales/errors";

export function dataResponse<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
    },
    { status },
  );
}

export function routeErrorResponse(error: unknown) {
  if (error instanceof ManagerAuthError) {
    return errorResponse(error.status, "AUTHORIZATION_ERROR", error.message);
  }

  if (error instanceof InventoryServiceError) {
    return errorResponse(error.status, error.code, error.message);
  }

  if (error instanceof ImportServiceError) {
    return errorResponse(error.status, error.code, error.message);
  }

  if (error instanceof LocationScopeError) {
    return errorResponse(error.status, error.code, error.message);
  }

  if (error instanceof PayrollServiceError) {
    return errorResponse(error.status, error.code, error.message);
  }

  if (error instanceof SalesServiceError) {
    return errorResponse(error.status, error.code, error.message);
  }

  if (error instanceof CloverConfigError) {
    return errorResponse(503, "CLOVER_NOT_CONFIGURED", error.message);
  }

  if (error instanceof CloverApiError) {
    if (error.status === 401 || error.status === 403) {
      return errorResponse(
        502,
        "CLOVER_API_ERROR",
        "Clover rejected this store's API token. Update it in Store setup.",
      );
    }
    return errorResponse(
      error.status >= 400 && error.status < 600 ? error.status : 502,
      "CLOVER_API_ERROR",
      error.message,
    );
  }

  if (error instanceof IllegalDocumentTransitionError) {
    return errorResponse(409, "ILLEGAL_DOCUMENT_TRANSITION", error.message);
  }

  if (error instanceof DocumentServiceError) {
    return errorResponse(
      error.status,
      error.code,
      error.message,
      error.details,
    );
  }

  if (error instanceof ZodError) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "The submitted data was not accepted.",
      error.issues,
    );
  }

  console.error("Manager route failed", {
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorMessage: error instanceof Error ? error.message : "Unknown failure",
    causeMessage:
      error instanceof Error && error.cause instanceof Error
        ? error.cause.message
        : undefined,
  });

  return errorResponse(
    500,
    "INTERNAL_ERROR",
    "The operation could not be completed.",
  );
}
