import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { integrationConnections } from "@/db/schema";
import { getServerEnv } from "@/lib/env";
import { dataResponse, errorResponse, routeErrorResponse } from "@/lib/http";
import { captureSourceDocument } from "@/services/documents/capture";
import { DocumentServiceError } from "@/services/documents/errors";
import { validateSourceFile } from "@/services/documents/file-validation";
import { inboundMailboxMatches } from "@/services/mail/inbound-mailbox";
import {
  decodePostmarkAttachment,
  PostmarkInboundMessageSchema,
  verifyPostmarkInboundAuthorization,
} from "@/integrations/postmark/inbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const env = getServerEnv();
    if (
      !verifyPostmarkInboundAuthorization(
        request.headers.get("authorization"),
        env.POSTMARK_INBOUND_SECRET,
      )
    ) {
      return errorResponse(
        401,
        "INVALID_INBOUND_EMAIL_AUTH",
        "The inbound email notification was not authenticated.",
      );
    }

    const message = PostmarkInboundMessageSchema.parse(await request.json());
    if (!env.DATABASE_URL) {
      return errorResponse(
        503,
        "DATABASE_NOT_CONFIGURED",
        "The manager document ledger is not configured.",
      );
    }

    const connections = await getDb()
      .select({
        organizationId: integrationConnections.organizationId,
        locationId: integrationConnections.locationId,
        externalAccountId: integrationConnections.externalAccountId,
        settings: integrationConnections.settings,
      })
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.sourceSystem, "postmark_inbound"),
          eq(integrationConnections.status, "active"),
        ),
      );

    const active = connections.filter(
      (connection) => connection.locationId,
    );
    if (active.length === 0) {
      return errorResponse(
        503,
        "INVOICE_INBOX_NOT_CONFIGURED",
        "Connect an invoice mailbox to a location in Settings before forwarding documents.",
      );
    }

    const connection = active.find((candidate) =>
      inboundMailboxMatches(candidate, message),
    );
    if (!connection?.locationId) {
      return errorResponse(
        403,
        "MAILBOX_MISMATCH",
        "The inbound message does not belong to a connected store mailbox.",
      );
    }

    const results = [];
    const rejected = [];
    for (const [index, attachment] of message.Attachments.entries()) {
      try {
        const bytes = decodePostmarkAttachment(
          attachment,
          env.DOCUMENT_MAX_BYTES,
        );
        const validation = validateSourceFile(
          bytes,
          attachment.ContentType,
          env.DOCUMENT_MAX_BYTES,
        );
        if (!validation.valid || !validation.detectedMimeType) {
          rejected.push({
            filename: attachment.Name,
            reason: validation.reason ?? "unsupported_document",
          });
          continue;
        }

        results.push(
          await captureSourceDocument({
            integrationActor: {
              organizationId: connection.organizationId,
              locationId: connection.locationId,
              externalId: "postmark_inbound",
              captureChannel: "inbound_email",
            },
            originalFilename: attachment.Name,
            mimeType: validation.detectedMimeType,
            bytes,
            paymentMethod: "invoice_due",
            sourceSystem: "postmark_inbound",
            externalId: `${message.MessageID}:${index}`,
          }),
        );
      } catch (error) {
        rejected.push({
          filename: attachment.Name,
          reason:
            error instanceof DocumentServiceError &&
            error.code === "DUPLICATE_DOCUMENT"
              ? "duplicate_document"
              : "attachment_rejected",
        });
      }
    }

    return dataResponse(
      {
        accepted: results.length,
        rejected,
        messageAccepted: true,
      },
      { status: 202 },
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
