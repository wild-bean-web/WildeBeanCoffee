import { z } from "zod";

export const CloverIdSchema = z.string().trim().min(1).max(256);
export const CloverCentsSchema = z.number().int().safe();
export const CloverTimestampMsSchema = z.number().int().safe().nonnegative();
export const CurrencyCodeSchema = z
  .string()
  .trim()
  .length(3)
  .transform((value) => value.toUpperCase())
  .pipe(z.string().regex(/^[A-Z]{3}$/));

export const CloverReferenceSchema = z
  .object({
    id: CloverIdSchema,
  })
  .passthrough();

function withoutEmployeeSecrets(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  const row = { ...(value as Record<string, unknown>) };
  delete row.pin;
  delete row.unhashedPin;
  delete row.hashedPin;
  delete row.email;
  return row;
}

export const CloverEmployeeSchema = z.preprocess(
  withoutEmployeeSecrets,
  z
    .object({
      id: CloverIdSchema,
      name: z.string().trim().min(1).max(256).optional(),
      nickname: z.string().trim().min(1).max(256).optional(),
      customId: z.string().optional(),
      isOwner: z.boolean().optional(),
    })
    .passthrough(),
);

export const CloverShiftSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") return value;
  const row = value as Record<string, unknown>;
  return {
    ...withoutEmployeeSecrets(row),
    inTime: row.inTime ?? row.in_time,
    outTime: row.outTime ?? row.out_time,
    overrideInTime: row.overrideInTime ?? row.override_in_time,
    overrideOutTime: row.overrideOutTime ?? row.override_out_time,
    deletedTime: row.deletedTime ?? row.deleted_time,
  };
}, z
  .object({
    id: CloverIdSchema,
    employee: z
      .object({
        id: CloverIdSchema,
        name: z.string().optional(),
        nickname: z.string().optional(),
      })
      .passthrough()
      .optional(),
    inTime: CloverTimestampMsSchema.optional(),
    outTime: CloverTimestampMsSchema.optional(),
    overrideInTime: CloverTimestampMsSchema.optional(),
    overrideOutTime: CloverTimestampMsSchema.optional(),
    deletedTime: CloverTimestampMsSchema.optional(),
  })
  .passthrough());

export type CloverEmployee = z.infer<typeof CloverEmployeeSchema>;
export type CloverShift = z.infer<typeof CloverShiftSchema>;

export function CloverCollectionSchema<T extends z.ZodType>(
  itemSchema: T,
) {
  return z.union([
    z.array(itemSchema),
    z
      .object({
        elements: z.array(itemSchema),
      })
      .passthrough(),
  ]);
}

export function CloverPageSchema<T extends z.ZodType>(itemSchema: T) {
  return z
    .object({
      elements: z.array(itemSchema),
      href: z.string().url().optional(),
    })
    .passthrough();
}

export const CloverWebhookOperationSchema = z.enum([
  "CREATE",
  "UPDATE",
  "DELETE",
]);

export const CloverWebhookUpdateSchema = z
  .object({
    objectId: z
      .string()
      .trim()
      .regex(/^[A-Z]+:[^:\s]+$/, "Invalid Clover webhook object ID."),
    type: CloverWebhookOperationSchema,
    ts: CloverTimestampMsSchema,
  })
  .strict();

export const CloverWebhookNotificationSchema = z
  .object({
    appId: CloverIdSchema,
    merchants: z
      .record(CloverIdSchema, z.array(CloverWebhookUpdateSchema).min(1))
      .refine((merchants) => Object.keys(merchants).length > 0, {
        message: "A Clover notification must contain at least one merchant.",
      }),
  })
  .strict();

export const CloverWebhookVerificationSchema = z
  .object({
    verificationCode: z.string().trim().min(1).max(512),
  })
  .strict();

export const CloverHostedCheckoutNotificationSchema = z
  .object({
    createdTime: z
      .union([CloverTimestampMsSchema, z.string().datetime({ offset: true })])
      .optional(),
    message: z.string().min(1).optional(),
    status: z.string().trim().min(1),
    type: z.string().trim().min(1),
    id: CloverIdSchema,
    merchantId: CloverIdSchema,
    checkoutSessionId: CloverIdSchema.optional(),
    data: z
      .union([
        z.string().min(1),
        z
          .object({
            checkoutSessionId: CloverIdSchema,
          })
          .passthrough(),
      ])
      .optional(),
  })
  .passthrough()
  .refine(
    (notification) =>
      Boolean(
        notification.checkoutSessionId ||
          (typeof notification.data === "string"
            ? notification.data
            : notification.data?.checkoutSessionId),
      ),
    {
      message: "Hosted Checkout notification is missing its checkout session.",
    },
  );

export const CloverWebhookPayloadSchema = z.union([
  CloverWebhookNotificationSchema,
  CloverWebhookVerificationSchema,
  CloverHostedCheckoutNotificationSchema,
]);

export type CloverWebhookUpdate = z.infer<typeof CloverWebhookUpdateSchema>;
export type CloverWebhookNotification = z.infer<
  typeof CloverWebhookNotificationSchema
>;
export type CloverHostedCheckoutNotification = z.infer<
  typeof CloverHostedCheckoutNotificationSchema
>;
export type CloverWebhookPayload = z.infer<typeof CloverWebhookPayloadSchema>;

export const CloverDiscountSchema = z
  .object({
    id: CloverIdSchema.optional(),
    discount: CloverReferenceSchema.optional(),
    name: z.string().default("Discount"),
    amount: CloverCentsSchema.optional(),
    percentage: z.number().finite().nonnegative().optional(),
  })
  .passthrough();

export const CloverModificationSchema = z
  .object({
    id: CloverIdSchema.optional(),
    name: z.string().optional(),
    alternateName: z.string().optional(),
    amount: CloverCentsSchema.optional(),
    quantitySold: z.number().finite().nonnegative().optional(),
    modifier: z
      .object({
        id: CloverIdSchema.optional(),
        name: z.string().optional(),
        alternateName: z.string().optional(),
        price: CloverCentsSchema.optional(),
        modifierGroup: CloverReferenceSchema.optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const CloverTaxRateSchema = z
  .object({
    id: CloverIdSchema.optional(),
    name: z.string().optional(),
    rate: z.number().int().safe().nonnegative().optional(),
    taxableAmount: CloverCentsSchema.optional(),
    taxAmount: CloverCentsSchema.optional(),
    isVat: z.boolean().optional(),
  })
  .passthrough();

export const CloverTenderSchema = z
  .object({
    id: CloverIdSchema.optional(),
    labelKey: z.string().optional(),
    label: z.string().optional(),
    opensCashDrawer: z.boolean().optional(),
    supportsTipping: z.boolean().optional(),
  })
  .passthrough();

export const CloverRefundSchema = z
  .object({
    id: CloverIdSchema,
    orderRef: CloverReferenceSchema.optional(),
    payment: CloverReferenceSchema.optional(),
    amount: CloverCentsSchema.nonnegative(),
    taxAmount: CloverCentsSchema.nonnegative().optional(),
    tipAmount: CloverCentsSchema.nonnegative().optional(),
    createdTime: CloverTimestampMsSchema,
    clientCreatedTime: CloverTimestampMsSchema.optional(),
    gatewayProcessingTime: CloverTimestampMsSchema.optional(),
    externalReferenceId: z.string().optional(),
    overrideMerchantTender: CloverTenderSchema.optional(),
    lineItems: CloverCollectionSchema(CloverReferenceSchema).optional(),
    taxableAmountRates: CloverCollectionSchema(CloverTaxRateSchema).optional(),
  })
  .passthrough();

export const CloverCardTransactionSchema = z
  .object({
    cardType: z.string().optional(),
    entryType: z.string().optional(),
    type: z.string().optional(),
    state: z.string().optional(),
  })
  .passthrough();

export const CloverPaymentSchema = z
  .object({
    id: CloverIdSchema,
    order: CloverReferenceSchema.optional(),
    employee: CloverReferenceSchema.optional(),
    tender: CloverTenderSchema.optional(),
    amount: CloverCentsSchema.nonnegative(),
    tipAmount: CloverCentsSchema.nonnegative().optional(),
    taxAmount: CloverCentsSchema.nonnegative().optional(),
    cashbackAmount: CloverCentsSchema.nonnegative().optional(),
    cashTendered: CloverCentsSchema.nonnegative().optional(),
    externalPaymentId: z.string().optional(),
    createdTime: CloverTimestampMsSchema,
    clientCreatedTime: CloverTimestampMsSchema.optional(),
    modifiedTime: CloverTimestampMsSchema.optional(),
    offline: z.boolean().optional(),
    result: z.string().trim().min(1),
    cardTransaction: CloverCardTransactionSchema.optional(),
    serviceCharge: z
      .object({
        id: CloverIdSchema.optional(),
        name: z.string().optional(),
        amount: CloverCentsSchema.optional(),
      })
      .passthrough()
      .optional(),
    additionalCharges: CloverCollectionSchema(
      z
        .object({
          id: CloverIdSchema.optional(),
          type: z.string().optional(),
          amount: CloverCentsSchema.optional(),
          rate: z.number().int().safe().optional(),
        })
        .passthrough(),
    ).optional(),
    taxRates: CloverCollectionSchema(CloverTaxRateSchema).optional(),
    refunds: CloverCollectionSchema(CloverRefundSchema).optional(),
    source: z.string().optional(),
    sourceChannel: z.string().optional(),
  })
  .passthrough();

export const CloverLineItemSchema = z
  .object({
    id: CloverIdSchema,
    item: CloverReferenceSchema.optional(),
    name: z.string().default("Unnamed item"),
    alternateName: z.string().optional(),
    price: CloverCentsSchema,
    priceWithModifiers: CloverCentsSchema.optional(),
    priceWithModifiersAndItemAndOrderDiscounts: CloverCentsSchema.optional(),
    quantity: z.number().finite().positive().optional(),
    unitQty: z.number().int().safe().nonnegative().optional(),
    unitName: z.string().optional(),
    itemCode: z.string().optional(),
    note: z.string().optional(),
    discounts: CloverCollectionSchema(CloverDiscountSchema).optional(),
    orderLevelDiscounts:
      CloverCollectionSchema(CloverDiscountSchema).optional(),
    discountAmount: CloverCentsSchema.optional(),
    orderLevelDiscountAmount: CloverCentsSchema.optional(),
    modifications: CloverCollectionSchema(
      CloverModificationSchema,
    ).optional(),
    taxRates: CloverCollectionSchema(CloverTaxRateSchema).optional(),
    refunded: z.boolean().optional(),
    exchanged: z.boolean().optional(),
  })
  .passthrough();

export const CloverOrderSchema = z
  .object({
    id: CloverIdSchema,
    currency: CurrencyCodeSchema,
    total: CloverCentsSchema,
    externalReferenceId: z.string().optional(),
    paymentState: z.string().optional(),
    title: z.string().optional(),
    note: z.string().optional(),
    orderType: z
      .object({
        id: CloverIdSchema.optional(),
        labelKey: z.string().optional(),
        label: z.string().optional(),
        systemOrderTypeId: z.string().optional(),
      })
      .passthrough()
      .optional(),
    state: z.string().nullable().optional(),
    createdTime: CloverTimestampMsSchema,
    clientCreatedTime: CloverTimestampMsSchema.optional(),
    modifiedTime: CloverTimestampMsSchema.optional(),
    source: z.string().optional(),
    sourceChannel: z.string().optional(),
    serviceCharge: z
      .object({
        id: CloverIdSchema.optional(),
        name: z.string().optional(),
        percentage: z.number().int().safe().optional(),
        percentageDecimal: z.number().int().safe().optional(),
      })
      .passthrough()
      .optional(),
    additionalCharges: CloverCollectionSchema(
      z
        .object({
          id: CloverIdSchema.optional(),
          type: z.string().optional(),
          amount: CloverCentsSchema.optional(),
          percentageDecimal: z.number().int().safe().optional(),
        })
        .passthrough(),
    ).optional(),
    discounts: CloverCollectionSchema(CloverDiscountSchema).optional(),
    lineItems: CloverCollectionSchema(CloverLineItemSchema).optional(),
    payments: CloverCollectionSchema(CloverPaymentSchema).optional(),
    refunds: CloverCollectionSchema(CloverRefundSchema).optional(),
  })
  .passthrough();

export type CloverDiscount = z.infer<typeof CloverDiscountSchema>;
export type CloverModification = z.infer<typeof CloverModificationSchema>;
export type CloverTaxRate = z.infer<typeof CloverTaxRateSchema>;
export type CloverTender = z.infer<typeof CloverTenderSchema>;
export type CloverRefund = z.infer<typeof CloverRefundSchema>;
export type CloverPayment = z.infer<typeof CloverPaymentSchema>;
export type CloverLineItem = z.infer<typeof CloverLineItemSchema>;
export type CloverOrder = z.infer<typeof CloverOrderSchema>;

export const NormalizedSourceChannelSchema = z.enum([
  "in_store",
  "online",
  "phone",
  "delivery",
  "pickup",
  "unknown",
]);
export type NormalizedSourceChannel = z.infer<
  typeof NormalizedSourceChannelSchema
>;

export const NormalizedTenderTypeSchema = z.enum([
  "cash",
  "card",
  "gift_card",
  "other",
  "unknown",
]);

const NormalizedCentsSchema = z.number().int().safe();
const NormalizedNonNegativeCentsSchema =
  NormalizedCentsSchema.nonnegative();
const IsoTimestampSchema = z.string().datetime({ offset: true });

export const NormalizedDiscountSchema = z
  .object({
    externalId: CloverIdSchema.nullable(),
    catalogDiscountExternalId: CloverIdSchema.nullable(),
    name: z.string(),
    amountCents: NormalizedNonNegativeCentsSchema.nullable(),
    percentageBasisPoints: z.number().int().safe().nonnegative().nullable(),
    scope: z.enum(["line_item", "order"]),
  })
  .strict();

export const NormalizedModifierSchema = z
  .object({
    externalId: CloverIdSchema.nullable(),
    catalogModifierExternalId: CloverIdSchema.nullable(),
    modifierGroupExternalId: CloverIdSchema.nullable(),
    name: z.string(),
    amountCents: NormalizedCentsSchema,
    quantity: z.number().finite().nonnegative(),
  })
  .strict();

export const NormalizedTaxSchema = z
  .object({
    externalId: CloverIdSchema.nullable(),
    name: z.string(),
    rateBasisPoints: z.number().finite().nonnegative().nullable(),
    taxableAmountCents: NormalizedCentsSchema.nullable(),
    amountCents: NormalizedCentsSchema,
    isVat: z.boolean(),
  })
  .strict();

export const NormalizedTenderSchema = z
  .object({
    externalId: CloverIdSchema.nullable(),
    label: z.string(),
    type: NormalizedTenderTypeSchema,
    cardBrand: z.string().nullable(),
  })
  .strict();

export const NormalizedRefundSchema = z
  .object({
    externalId: CloverIdSchema,
    merchantId: CloverIdSchema,
    orderExternalId: CloverIdSchema.nullable(),
    paymentExternalId: CloverIdSchema.nullable(),
    externalReferenceId: z.string().nullable(),
    currency: CurrencyCodeSchema,
    amountCents: NormalizedNonNegativeCentsSchema,
    subtotalAmountCents: NormalizedNonNegativeCentsSchema,
    taxAmountCents: NormalizedNonNegativeCentsSchema,
    tipAmountCents: NormalizedNonNegativeCentsSchema,
    occurredAt: IsoTimestampSchema,
    lineItemExternalIds: z.array(CloverIdSchema),
    tender: NormalizedTenderSchema.nullable(),
    sourceChannel: NormalizedSourceChannelSchema,
  })
  .strict();

export const NormalizedPaymentSchema = z
  .object({
    externalId: CloverIdSchema,
    merchantId: CloverIdSchema,
    orderExternalId: CloverIdSchema.nullable(),
    externalPaymentId: z.string().nullable(),
    currency: CurrencyCodeSchema,
    status: z.string().min(1),
    amountCents: NormalizedNonNegativeCentsSchema,
    subtotalAmountCents: NormalizedNonNegativeCentsSchema,
    taxAmountCents: NormalizedNonNegativeCentsSchema,
    tipAmountCents: NormalizedNonNegativeCentsSchema,
    serviceChargeAmountCents: NormalizedNonNegativeCentsSchema,
    additionalChargeAmountCents: NormalizedNonNegativeCentsSchema,
    totalCollectedCents: NormalizedNonNegativeCentsSchema,
    refundedAmountCents: NormalizedNonNegativeCentsSchema,
    netCollectedCents: NormalizedCentsSchema,
    occurredAt: IsoTimestampSchema,
    modifiedAt: IsoTimestampSchema.nullable(),
    offline: z.boolean(),
    tender: NormalizedTenderSchema,
    taxes: z.array(NormalizedTaxSchema),
    refunds: z.array(NormalizedRefundSchema),
    sourceChannel: NormalizedSourceChannelSchema,
  })
  .strict();

export const NormalizedLineItemSchema = z
  .object({
    externalId: CloverIdSchema,
    itemExternalId: CloverIdSchema.nullable(),
    name: z.string(),
    itemCode: z.string().nullable(),
    note: z.string().nullable(),
    quantity: z.number().finite().positive(),
    unitName: z.string().nullable(),
    unitPriceCents: NormalizedCentsSchema,
    baseAmountCents: NormalizedCentsSchema,
    modifierAmountCents: NormalizedCentsSchema,
    grossAmountCents: NormalizedCentsSchema,
    discountAmountCents: NormalizedNonNegativeCentsSchema,
    netAmountCents: NormalizedCentsSchema,
    modifiers: z.array(NormalizedModifierSchema),
    discounts: z.array(NormalizedDiscountSchema),
    taxes: z.array(NormalizedTaxSchema),
    refunded: z.boolean(),
    exchanged: z.boolean(),
  })
  .strict();

export const NormalizedOrderSchema = z
  .object({
    externalId: CloverIdSchema,
    merchantId: CloverIdSchema,
    externalReferenceId: z.string().nullable(),
    currency: CurrencyCodeSchema,
    state: z.string().nullable(),
    paymentState: z.string().nullable(),
    title: z.string().nullable(),
    note: z.string().nullable(),
    totalCents: NormalizedCentsSchema,
    lineItemGrossCents: NormalizedCentsSchema,
    lineItemNetCents: NormalizedCentsSchema,
    discountAmountCents: NormalizedNonNegativeCentsSchema,
    paymentAmountCents: NormalizedNonNegativeCentsSchema,
    tipAmountCents: NormalizedNonNegativeCentsSchema,
    taxAmountCents: NormalizedNonNegativeCentsSchema,
    refundAmountCents: NormalizedNonNegativeCentsSchema,
    netCollectedCents: NormalizedCentsSchema,
    createdAt: IsoTimestampSchema,
    modifiedAt: IsoTimestampSchema.nullable(),
    sourceChannel: NormalizedSourceChannelSchema,
    sourceChannelRaw: z.string().nullable(),
    lineItems: z.array(NormalizedLineItemSchema),
    discounts: z.array(NormalizedDiscountSchema),
    taxes: z.array(NormalizedTaxSchema),
    payments: z.array(NormalizedPaymentSchema),
    refunds: z.array(NormalizedRefundSchema),
  })
  .strict();

export type NormalizedDiscount = z.infer<typeof NormalizedDiscountSchema>;
export type NormalizedModifier = z.infer<typeof NormalizedModifierSchema>;
export type NormalizedTax = z.infer<typeof NormalizedTaxSchema>;
export type NormalizedTender = z.infer<typeof NormalizedTenderSchema>;
export type NormalizedRefund = z.infer<typeof NormalizedRefundSchema>;
export type NormalizedPayment = z.infer<typeof NormalizedPaymentSchema>;
export type NormalizedLineItem = z.infer<typeof NormalizedLineItemSchema>;
export type NormalizedOrder = z.infer<typeof NormalizedOrderSchema>;
