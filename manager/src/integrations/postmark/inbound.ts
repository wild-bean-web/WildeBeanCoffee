import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const PostmarkInboundAttachmentSchema = z.object({
  Name: z.string().trim().min(1).max(255),
  Content: z.string().min(1),
  ContentType: z.string().trim().min(1).max(128),
  ContentLength: z.number().int().nonnegative().optional(),
  ContentID: z.string().optional(),
});

export const PostmarkInboundMessageSchema = z
  .object({
    MessageID: z.string().trim().min(1).max(256),
    From: z.string().trim().min(1).max(320),
    To: z.string().trim().min(1).max(2_000),
    Subject: z.string().max(1_000).default(""),
    MailboxHash: z.string().max(256).default(""),
    Attachments: z.array(PostmarkInboundAttachmentSchema).max(50).default([]),
  });

export type PostmarkInboundMessage = z.infer<
  typeof PostmarkInboundMessageSchema
>;

function equal(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

export function verifyPostmarkInboundAuthorization(
  authorizationHeader: string | null,
  expectedSecret: string | undefined,
): boolean {
  if (!authorizationHeader || !expectedSecret) return false;
  if (authorizationHeader.startsWith("Bearer ")) {
    return equal(authorizationHeader.slice(7).trim(), expectedSecret);
  }
  if (!authorizationHeader.startsWith("Basic ")) return false;

  try {
    const decoded = Buffer.from(
      authorizationHeader.slice(6).trim(),
      "base64",
    ).toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 1) return false;
    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);
    return equal(username, "postmark") && equal(password, expectedSecret);
  } catch {
    return false;
  }
}

export function decodePostmarkAttachment(
  attachment: z.infer<typeof PostmarkInboundAttachmentSchema>,
  maxBytes: number,
): Uint8Array {
  const bytes = Buffer.from(attachment.Content, "base64");
  if (bytes.byteLength === 0 || bytes.byteLength > maxBytes) {
    throw new Error("Inbound attachment size is not accepted.");
  }
  if (
    attachment.ContentLength !== undefined &&
    attachment.ContentLength !== bytes.byteLength
  ) {
    throw new Error("Inbound attachment length does not match its metadata.");
  }
  return new Uint8Array(bytes);
}
