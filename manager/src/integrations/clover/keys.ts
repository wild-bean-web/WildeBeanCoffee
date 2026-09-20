import { z } from "zod";

import {
  CloverIdSchema,
  CloverTimestampMsSchema,
  CloverWebhookUpdateSchema,
  type CloverWebhookUpdate,
} from "./schemas";

export const CloverExternalResourceSchema = z.enum([
  "order",
  "payment",
  "refund",
  "line_item",
]);
export type CloverExternalResource = z.infer<
  typeof CloverExternalResourceSchema
>;

export interface ParsedCloverObjectId {
  readonly eventPrefix: string;
  readonly externalId: string;
}

function encodeKeyPart(value: string): string {
  return encodeURIComponent(value);
}

export function parseCloverObjectId(objectId: string): ParsedCloverObjectId {
  const parsedObjectId = CloverWebhookUpdateSchema.shape.objectId.parse(objectId);
  const separatorIndex = parsedObjectId.indexOf(":");

  return Object.freeze({
    eventPrefix: parsedObjectId.slice(0, separatorIndex),
    externalId: parsedObjectId.slice(separatorIndex + 1),
  });
}

/**
 * Stable provider key for upserting the current representation of an object.
 */
export function buildCloverExternalKey(
  resource: CloverExternalResource,
  merchantId: string,
  externalId: string,
): string {
  const parsedResource = CloverExternalResourceSchema.parse(resource);
  const parsedMerchantId = CloverIdSchema.parse(merchantId);
  const parsedExternalId = CloverIdSchema.parse(externalId);

  return [
    "clover",
    "v1",
    parsedResource,
    encodeKeyPart(parsedMerchantId),
    encodeKeyPart(parsedExternalId),
  ].join(":");
}

/**
 * Stable delivery key. Re-delivery of the same merchant/object/operation/time
 * yields the same key, while a later update to the same object does not.
 */
export function buildCloverWebhookIdempotencyKey(
  merchantId: string,
  update: CloverWebhookUpdate,
): string {
  const parsedMerchantId = CloverIdSchema.parse(merchantId);
  const parsedUpdate = CloverWebhookUpdateSchema.parse(update);

  return [
    "clover",
    "webhook",
    "v1",
    encodeKeyPart(parsedMerchantId),
    encodeKeyPart(parsedUpdate.objectId),
    parsedUpdate.type.toLowerCase(),
    String(parsedUpdate.ts),
  ].join(":");
}

/**
 * Stable key for a particular observed version during polling/backfills.
 */
export function buildCloverObjectVersionKey(
  resource: CloverExternalResource,
  merchantId: string,
  externalId: string,
  modifiedTimeMs: number,
): string {
  const objectKey = buildCloverExternalKey(resource, merchantId, externalId);
  const parsedModifiedTime = CloverTimestampMsSchema.parse(modifiedTimeMs);
  return `${objectKey}:version:${parsedModifiedTime}`;
}
