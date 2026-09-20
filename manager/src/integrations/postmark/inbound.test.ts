import { describe, expect, it } from "vitest";
import {
  decodePostmarkAttachment,
  PostmarkInboundMessageSchema,
  verifyPostmarkInboundAuthorization,
} from "./inbound";

describe("Postmark inbound invoice boundary", () => {
  it("accepts configured basic authentication", () => {
    const header = `Basic ${Buffer.from(`postmark:${"a".repeat(32)}`).toString("base64")}`;
    expect(
      verifyPostmarkInboundAuthorization(header, "a".repeat(32)),
    ).toBe(true);
    expect(
      verifyPostmarkInboundAuthorization(header, "b".repeat(32)),
    ).toBe(false);
  });

  it("validates and decodes attachment lengths", () => {
    const bytes = new TextEncoder().encode("%PDF-1.7\ninvoice");
    const attachment = {
      Name: "invoice.pdf",
      Content: Buffer.from(bytes).toString("base64"),
      ContentType: "application/pdf",
      ContentLength: bytes.byteLength,
    };
    expect(decodePostmarkAttachment(attachment, 1_000)).toEqual(bytes);
    expect(() =>
      decodePostmarkAttachment(
        { ...attachment, ContentLength: bytes.byteLength + 1 },
        1_000,
      ),
    ).toThrow("length");
  });

  it("does not require or preserve the email body", () => {
    const message = PostmarkInboundMessageSchema.parse({
      MessageID: "message-1",
      From: "vendor@example.com",
      To: "invoices@example.com",
      Subject: "Invoice",
      Attachments: [],
      TextBody: "This body may contain unnecessary information.",
    });
    expect(message.Attachments).toEqual([]);
    expect("TextBody" in message).toBe(false);
  });
});
