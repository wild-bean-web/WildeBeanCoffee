import type { CafeAddress, ManagerLocation } from "@/lib/location";

export interface LocationSetupSnapshot {
  location: ManagerLocation | null;
  identity: {
    name: string;
    timezone: string;
    address: CafeAddress;
  } | null;
  clover: {
    configured: boolean;
    merchantId: string;
    tokenConfigured: boolean;
    tokenSource: "stored" | "env" | "missing";
    tokenLast4: string | null;
  };
  mailbox: {
    configured: boolean;
    invoiceEmail: string;
    mailboxHash: string;
  };
  brand: {
    databaseConfigured: boolean;
    documentsConfigured: boolean;
    cloverWebhookConfigured: boolean;
    postmarkConfigured: boolean;
    documentAiConfigured: boolean;
  };
  canManage: boolean;
}
