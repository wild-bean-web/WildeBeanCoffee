import type { JsonObject } from "@/db/schema/shared";

export const POSTMARK_ENV_SECRET_REFERENCE = "env:POSTMARK_INBOUND_SECRET";

export interface MailboxConnectionView {
  readonly externalAccountId: string;
  readonly settings: JsonObject;
}

export interface MailboxEndpoints {
  readonly invoiceEmail: string;
  readonly mailboxHash: string;
}

function settingString(settings: JsonObject, key: string): string {
  const value = settings[key];
  return typeof value === "string" ? value.trim() : "";
}

export function mailboxFromConnection(
  connection: MailboxConnectionView,
): MailboxEndpoints {
  const storedEmail = settingString(connection.settings, "invoiceEmail");
  const storedHash = settingString(connection.settings, "mailboxHash");
  const external = connection.externalAccountId.trim();
  const externalLooksLikeEmail = external.includes("@");

  return {
    invoiceEmail: storedEmail || (externalLooksLikeEmail ? external : ""),
    mailboxHash: storedHash || (!externalLooksLikeEmail ? external : ""),
  };
}

export function mailboxConnectionConfigured(
  connection: MailboxConnectionView | null | undefined,
): boolean {
  if (!connection) return false;
  const mailbox = mailboxFromConnection(connection);
  return Boolean(mailbox.invoiceEmail || mailbox.mailboxHash);
}

export function inboundMailboxMatches(
  connection: MailboxConnectionView,
  message: { MailboxHash?: string; To: string },
): boolean {
  const mailbox = mailboxFromConnection(connection);
  if (mailbox.mailboxHash && message.MailboxHash === mailbox.mailboxHash) {
    return true;
  }
  if (
    mailbox.invoiceEmail &&
    message.To.toLowerCase().includes(mailbox.invoiceEmail.toLowerCase())
  ) {
    return true;
  }
  return false;
}
