import { describe, expect, it } from "vitest";
import {
  inboundMailboxMatches,
  mailboxConnectionConfigured,
  mailboxFromConnection,
} from "./inbound-mailbox";

const rockville = {
  externalAccountId: "wbc-rockville",
  settings: {
    invoiceEmail: "invoices+rockville@wildbeancoffeeshop.com",
    mailboxHash: "wbc-rockville",
  },
};

describe("location invoice mailbox", () => {
  it("prefers stored email and hash over the external account id", () => {
    expect(mailboxFromConnection(rockville)).toEqual({
      invoiceEmail: "invoices+rockville@wildbeancoffeeshop.com",
      mailboxHash: "wbc-rockville",
    });
  });

  it("treats an email external id as the mailbox address", () => {
    expect(
      mailboxFromConnection({
        externalAccountId: "invoices@wildbeancoffeeshop.com",
        settings: {},
      }),
    ).toEqual({
      invoiceEmail: "invoices@wildbeancoffeeshop.com",
      mailboxHash: "",
    });
  });

  it("matches Postmark hash or recipient independently", () => {
    expect(
      inboundMailboxMatches(rockville, {
        MailboxHash: "wbc-rockville",
        To: "someone else",
      }),
    ).toBe(true);
    expect(
      inboundMailboxMatches(rockville, {
        MailboxHash: "other",
        To: '"Inbox" <invoices+rockville@wildbeancoffeeshop.com>',
      }),
    ).toBe(true);
    expect(
      inboundMailboxMatches(rockville, {
        MailboxHash: "other",
        To: "invoices+silver-spring@wildbeancoffeeshop.com",
      }),
    ).toBe(false);
  });

  it("is configured when either endpoint is present", () => {
    expect(mailboxConnectionConfigured(rockville)).toBe(true);
    expect(
      mailboxConnectionConfigured({
        externalAccountId: "invoices@wildbeancoffeeshop.com",
        settings: {},
      }),
    ).toBe(true);
    expect(
      mailboxConnectionConfigured({
        externalAccountId: "pending",
        settings: {},
      }),
    ).toBe(true);
  });
});
