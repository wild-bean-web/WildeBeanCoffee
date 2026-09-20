import "server-only";

import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

export interface StoreDocumentInput {
  organizationId: string;
  documentId: string;
  originalFilename: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface StoredDocument {
  objectKey: string;
  sha256: string;
  byteSize: number;
}

export interface DocumentStore {
  storeOriginal(input: StoreDocumentInput): Promise<StoredDocument>;
  readOriginal(objectKey: string): Promise<Uint8Array>;
  createReadUrl(objectKey: string, expiresInSeconds?: number): Promise<string>;
  removeOriginal(objectKey: string): Promise<void>;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function digestSourceBytes(bytes: Uint8Array): string {
  return sha256(bytes);
}

function safeExtension(filename: string): string {
  const match = filename.toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  return match ? `.${match[1]}` : "";
}

class SupabaseDocumentStore implements DocumentStore {
  private readonly client: SupabaseClient;

  constructor(
    url: string,
    serviceRoleKey: string,
    private readonly bucket: string,
  ) {
    this.client = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async storeOriginal(input: StoreDocumentInput): Promise<StoredDocument> {
    const digest = sha256(input.bytes);
    const objectKey = [
      input.organizationId,
      "quarantine",
      input.documentId,
      `${digest}${safeExtension(input.originalFilename)}`,
    ].join("/");

    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(objectKey, input.bytes, {
        contentType: input.mimeType,
        upsert: false,
        cacheControl: "private, no-store",
      });

    if (error && !error.message.toLowerCase().includes("already exists")) {
      throw new Error(
        `The source document could not be secured. ${error.message}`,
      );
    }

    return {
      objectKey,
      sha256: digest,
      byteSize: input.bytes.byteLength,
    };
  }

  async createReadUrl(
    objectKey: string,
    expiresInSeconds = 120,
  ): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(objectKey, expiresInSeconds, { download: false });

    if (error) {
      throw new Error("A secure document link could not be created.");
    }

    return data.signedUrl;
  }

  async removeOriginal(objectKey: string): Promise<void> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .remove([objectKey]);
    if (error) {
      throw new Error(
        `The source document could not be removed from storage. ${error.message}`,
      );
    }
  }

  async readOriginal(objectKey: string): Promise<Uint8Array> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .download(objectKey);
    if (error) {
      throw new Error("The secured source document could not be read.");
    }
    return new Uint8Array(await data.arrayBuffer());
  }
}

const memoryDocuments = new Map<string, Uint8Array>();

class MemoryDocumentStore implements DocumentStore {
  async storeOriginal(input: StoreDocumentInput): Promise<StoredDocument> {
    const digest = sha256(input.bytes);
    const objectKey = `memory://${input.organizationId}/${input.documentId}/${digest}`;
    memoryDocuments.set(objectKey, Uint8Array.from(input.bytes));
    return {
      objectKey,
      sha256: digest,
      byteSize: input.bytes.byteLength,
    };
  }

  async createReadUrl(objectKey: string): Promise<string> {
    if (!memoryDocuments.has(objectKey)) {
      throw new Error("Document not found.");
    }
    return objectKey;
  }

  async readOriginal(objectKey: string): Promise<Uint8Array> {
    const bytes = memoryDocuments.get(objectKey);
    if (!bytes) throw new Error("Document not found.");
    return Uint8Array.from(bytes);
  }

  async removeOriginal(objectKey: string): Promise<void> {
    memoryDocuments.delete(objectKey);
  }
}

let cachedStore: DocumentStore | undefined;

export function getDocumentStore(): DocumentStore {
  if (cachedStore) return cachedStore;

  const env = getServerEnv();
  if (env.DOCUMENT_STORAGE_PROVIDER === "memory") {
    cachedStore = new MemoryDocumentStore();
    return cachedStore;
  }

  if (
    !env.NEXT_PUBLIC_SUPABASE_URL ||
    !env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    if (env.NODE_ENV !== "production") {
      cachedStore = new MemoryDocumentStore();
      return cachedStore;
    }
    throw new Error("Private document storage is not configured.");
  }

  cachedStore = new SupabaseDocumentStore(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    env.DOCUMENT_STORAGE_BUCKET,
  );
  return cachedStore;
}
