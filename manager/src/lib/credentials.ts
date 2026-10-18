import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const PREFIX = "enc:v1:";

function keyFrom(material: string): Buffer {
  return createHash("sha256")
    .update(`wild-bean-manager-credentials:${material}`)
    .digest();
}

function credentialKeys(): Buffer[] {
  const stable = process.env.MANAGER_CREDENTIALS_KEY?.trim();
  const database = process.env.DATABASE_URL?.trim();
  const keys: Buffer[] = [];
  if (stable) keys.push(keyFrom(stable));
  if (database && database !== stable) keys.push(keyFrom(database));
  if (keys.length === 0) {
    throw new Error("A credentials key or DATABASE_URL is required to store secrets.");
  }
  return keys;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", credentialKeys()[0], iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptWith(packed: string, key: Buffer): string {
  if (!packed.startsWith(PREFIX)) {
    throw new Error("The stored credential is not a recognized ciphertext.");
  }
  const [ivPart, tagPart, dataPart] = packed.slice(PREFIX.length).split(".");
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("The stored credential is malformed.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function rewrapSecret(packed: string): {
  plain: string;
  packed: string;
  changed: boolean;
} {
  const keys = credentialKeys();
  let lastError: unknown;
  for (let index = 0; index < keys.length; index += 1) {
    try {
      const plain = decryptWith(packed, keys[index]);
      if (index === 0) return { plain, packed, changed: false };
      return { plain, packed: encryptSecret(plain), changed: true };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("The stored credential could not be unlocked.");
}

export function decryptSecret(packed: string): string {
  return rewrapSecret(packed).plain;
}

export function secretLast4(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return trimmed;
  return trimmed.slice(-4);
}
