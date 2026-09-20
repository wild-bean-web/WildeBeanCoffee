import { z } from "zod";

const modifierSchema = z.object({
  modifierGroupName: z.string().trim().min(1).max(200),
  selectedOptions: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        price: z.number().finite().nonnegative().default(0),
        quantity: z.number().int().positive().default(1),
      }),
    )
    .max(100),
});

const itemSchema = z.object({
  lineId: z.string().trim().min(1).max(256),
  itemType: z.enum(["product", "menu"]),
  itemId: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(500),
  price: z.number().finite().nonnegative(),
  quantity: z.number().int().positive().max(10_000),
  modifierTotal: z.number().finite().nonnegative().default(0),
  modifiers: z.array(modifierSchema).max(100).default([]),
  loyaltyRewardApplied: z.boolean().default(false),
});

export const StorefrontOutboxEventSchema = z
  .object({
    schemaVersion: z.literal(1),
    eventId: z.string().uuid(),
    eventType: z.enum([
      "website.order.paid",
      "website.order.refunded",
      "website.order.cancelled",
    ]),
    organizationSlug: z.literal("wild-bean-coffee"),
    occurredAt: z.iso.datetime({ offset: true }),
    order: z.object({
      id: z.string().trim().min(1).max(128),
      paymentRef: z.string().trim().min(1).max(512),
      paymentStatus: z.enum([
        "pending",
        "authorized",
        "paid",
        "failed",
        "refunded",
      ]),
      status: z.enum([
        "placed",
        "preparing",
        "ready",
        "completed",
        "cancelled",
      ]),
      source: z.literal("wild_bean_website"),
      items: z.array(itemSchema).min(1).max(1_000),
      totals: z.object({
        subtotal: z.number().finite().nonnegative(),
        tax: z.number().finite().nonnegative(),
        tip: z.number().finite().nonnegative().default(0),
        total: z.number().finite().nonnegative(),
        currency: z.string().trim().length(3),
      }),
      createdAt: z.iso.datetime({ offset: true }),
      updatedAt: z.iso.datetime({ offset: true }),
    }),
  })
  .strict();

export type StorefrontOutboxEvent = z.infer<
  typeof StorefrontOutboxEventSchema
>;
