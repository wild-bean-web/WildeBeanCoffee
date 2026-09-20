import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const PREFIX = "enc:v1:";

function credentialsKey(): Buffer {
  const material =
    process.env.MANAGER_CREDENTIALS_KEY?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (!material) {
    throw new Error("A credentials key or DATABASE_URL is required to store secrets.");
  }
  return createHash("sha256")
    .update(`wild-bean-manager-credentials:${material}`)
    .digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", credentialsKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(packed: string): string {
  if (!packed.startsWith(PREFIX)) {
    throw new Error("The stored credential is not a recognized ciphertext.");
  }
  const [ivPart, tagPart, dataPart] = packed.slice(PREFIX.length).split(".");
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("The stored credential is malformed.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    credentialsKey(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function secretLast4(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return trimmed;
  return trimmed.slice(-4);
}
