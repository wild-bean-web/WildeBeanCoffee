import {
  CloverCentsSchema,
  CloverIdSchema,
  CloverLineItemSchema,
  CloverOrderSchema,
  CloverPaymentSchema,
  CloverRefundSchema,
  CurrencyCodeSchema,
  NormalizedDiscountSchema,
  NormalizedLineItemSchema,
  NormalizedModifierSchema,
  NormalizedOrderSchema,
  NormalizedPaymentSchema,
  NormalizedRefundSchema,
  NormalizedSourceChannelSchema,
  NormalizedTaxSchema,
  NormalizedTenderSchema,
  type CloverDiscount,
  type CloverModification,
  type CloverOrder,
  type CloverTaxRate,
  type CloverTender,
  type NormalizedDiscount,
  type NormalizedLineItem,
  type NormalizedModifier,
  type NormalizedOrder,
  type NormalizedPayment,
  type NormalizedRefund,
  type NormalizedSourceChannel,
  type NormalizedTax,
  type NormalizedTender,
} from "./schemas";

export interface CloverNormalizationContext {
  readonly merchantId: string;
  readonly currency: string;
  readonly sourceChannel?: NormalizedSourceChannel;
}

export interface CloverOrderNormalizationContext {
  readonly merchantId: string;
  readonly sourceChannel?: NormalizedSourceChannel;
}

type CloverCollection<T> =
  | T[]
  | ({
      elements: T[];
    } & Record<string, unknown>);

function collectionElements<T>(
  collection: CloverCollection<T> | null | undefined,
): T[] {
  if (!collection) {
    return [];
  }
  return Array.isArray(collection) ? collection : collection.elements;
}

function isoTimestamp(timestampMs: number): string {
  return new Date(timestampMs).toISOString();
}

function sumCents(values: readonly number[]): number {
  return CloverCentsSchema.parse(
    values.reduce((total, value) => total + value, 0),
  );
}

function normalizeContext(
  context: CloverNormalizationContext,
): Required<CloverNormalizationContext> {
  return {
    merchantId: CloverIdSchema.parse(context.merchantId),
    currency: CurrencyCodeSchema.parse(context.currency),
    sourceChannel: NormalizedSourceChannelSchema.parse(
      context.sourceChannel ?? "unknown",
    ),
  };
}

function textCandidate(values: readonly (string | null | undefined)[]) {
  return values.find((value) => value && value.trim().length > 0)?.trim() ?? null;
}

function sourceFromText(value: string | null): NormalizedSourceChannel {
  if (!value) {
    return "unknown";
  }

  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  if (
    /\b(delivery|doordash|door dash|uber eats|grubhub|courier)\b/.test(
      normalized,
    )
  ) {
    return "delivery";
  }
  if (/\b(pickup|pick up|takeout|take out|to go|togo)\b/.test(normalized)) {
    return "pickup";
  }
  if (/\b(phone|telephone|call in)\b/.test(normalized)) {
    return "phone";
  }
  if (/\b(online|web|ecommerce|e commerce|hosted checkout)\b/.test(normalized)) {
    return "online";
  }
  if (/\b(in store|instore|dine in|register|counter|pos)\b/.test(normalized)) {
    return "in_store";
  }
  return "unknown";
}

export function inferCloverSourceChannel(
  order: Pick<CloverOrder, "source" | "sourceChannel" | "orderType">,
): {
  readonly channel: NormalizedSourceChannel;
  readonly raw: string | null;
} {
  const raw = textCandidate([
    order.sourceChannel,
    order.source,
    order.orderType?.systemOrderTypeId,
    order.orderType?.labelKey,
    order.orderType?.label,
  ]);

  return Object.freeze({ channel: sourceFromText(raw), raw });
}

function normalizeDiscount(
  untrustedDiscount: CloverDiscount,
  scope: "line_item" | "order",
): NormalizedDiscount {
  const discount = NormalizedDiscountSchema.parse({
    externalId: untrustedDiscount.id ?? null,
    catalogDiscountExternalId: untrustedDiscount.discount?.id ?? null,
    name: untrustedDiscount.name,
    amountCents:
      untrustedDiscount.amount === undefined
        ? null
        : Math.abs(untrustedDiscount.amount),
    percentageBasisPoints:
      untrustedDiscount.percentage === undefined
        ? null
        : Math.round(untrustedDiscount.percentage * 100),
    scope,
  });
  return discount;
}

function normalizeModifier(
  untrustedModification: CloverModification,
): NormalizedModifier {
  return NormalizedModifierSchema.parse({
    externalId: untrustedModification.id ?? null,
    catalogModifierExternalId: untrustedModification.modifier?.id ?? null,
    modifierGroupExternalId:
      untrustedModification.modifier?.modifierGroup?.id ?? null,
    name:
      textCandidate([
        untrustedModification.name,
        untrustedModification.modifier?.name,
        untrustedModification.alternateName,
        untrustedModification.modifier?.alternateName,
      ]) ?? "Modifier",
    amountCents:
      untrustedModification.amount ??
      untrustedModification.modifier?.price ??
      0,
    quantity: untrustedModification.quantitySold ?? 1,
  });
}

function normalizeTax(untrustedTax: CloverTaxRate): NormalizedTax {
  return NormalizedTaxSchema.parse({
    externalId: untrustedTax.id ?? null,
    name: untrustedTax.name ?? "Tax",
    rateBasisPoints:
      untrustedTax.rate === undefined ? null : untrustedTax.rate / 1_000,
    taxableAmountCents: untrustedTax.taxableAmount ?? null,
    amountCents: untrustedTax.taxAmount ?? 0,
    isVat: untrustedTax.isVat ?? false,
  });
}

function aggregateTaxes(taxes: readonly NormalizedTax[]): NormalizedTax[] {
  const aggregates = new Map<
    string,
    {
      externalId: string | null;
      name: string;
      rateBasisPoints: number | null;
      taxableAmountCents: number | null;
      amountCents: number;
      isVat: boolean;
    }
  >();

  for (const tax of taxes) {
    const key =
      tax.externalId ??
      [tax.name, tax.rateBasisPoints ?? "none", tax.isVat].join("|");
    const aggregate = aggregates.get(key);
    if (!aggregate) {
      aggregates.set(key, { ...tax });
      continue;
    }

    aggregate.amountCents = sumCents([
      aggregate.amountCents,
      tax.amountCents,
    ]);
    aggregate.taxableAmountCents =
      aggregate.taxableAmountCents === null &&
      tax.taxableAmountCents === null
        ? null
        : sumCents([
            aggregate.taxableAmountCents ?? 0,
            tax.taxableAmountCents ?? 0,
          ]);
  }

  return [...aggregates.values()].map((tax) =>
    NormalizedTaxSchema.parse(tax),
  );
}

function classifyTender(
  tender: CloverTender | undefined,
  cardBrand: string | undefined,
): NormalizedTender["type"] {
  const description = [
    tender?.labelKey,
    tender?.label,
    cardBrand,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  if (/gift|stored value/.test(description)) {
    return "gift_card";
  }
  if (cardBrand || /credit|debit|card|visa|mastercard|amex/.test(description)) {
    return "card";
  }
  if (/cash/.test(description)) {
    return "cash";
  }
  if (description) {
    return "other";
  }
  return "unknown";
}

function normalizeTender(
  tender: CloverTender | undefined,
  cardBrand?: string,
): NormalizedTender {
  return NormalizedTenderSchema.parse({
    externalId: tender?.id ?? null,
    label:
      textCandidate([tender?.label, tender?.labelKey, cardBrand]) ??
      "Unknown tender",
    type: classifyTender(tender, cardBrand),
    cardBrand: cardBrand ?? null,
  });
}

export function normalizeCloverLineItem(
  untrustedLineItem: unknown,
): NormalizedLineItem {
  const lineItem = CloverLineItemSchema.parse(untrustedLineItem);
  const modifiers = collectionElements(lineItem.modifications).map(
    normalizeModifier,
  );
  const lineDiscounts = collectionElements(lineItem.discounts).map(
    (discount) => normalizeDiscount(discount, "line_item"),
  );
  const orderDiscounts = collectionElements(lineItem.orderLevelDiscounts).map(
    (discount) => normalizeDiscount(discount, "order"),
  );
  const discounts = [...lineDiscounts, ...orderDiscounts];
  const taxes = collectionElements(lineItem.taxRates).map(normalizeTax);

  const quantity =
    lineItem.quantity ??
    (lineItem.unitQty !== undefined && lineItem.unitQty > 0
      ? lineItem.unitQty / 1_000
      : 1);
  const baseAmountCents =
    lineItem.unitQty !== undefined
      ? Math.round((lineItem.price * lineItem.unitQty) / 1_000)
      : Math.round(lineItem.price * quantity);
  const modifierAmountCents = sumCents(
    modifiers.map((modifier) =>
      Math.round(modifier.amountCents * modifier.quantity),
    ),
  );
  const grossAmountCents =
    lineItem.priceWithModifiers ?? baseAmountCents + modifierAmountCents;

  const statedDiscountAmount = sumCents([
    Math.abs(lineItem.discountAmount ?? 0),
    Math.abs(lineItem.orderLevelDiscountAmount ?? 0),
  ]);
  const itemizedDiscountAmount = sumCents(
    discounts.map((discount) => discount.amountCents ?? 0),
  );
  const calculatedNetAmount =
    lineItem.priceWithModifiersAndItemAndOrderDiscounts;
  const discountAmountCents =
    calculatedNetAmount === undefined
      ? Math.max(statedDiscountAmount, itemizedDiscountAmount)
      : Math.max(0, grossAmountCents - calculatedNetAmount);
  const netAmountCents =
    calculatedNetAmount ?? grossAmountCents - discountAmountCents;

  return NormalizedLineItemSchema.parse({
    externalId: lineItem.id,
    itemExternalId: lineItem.item?.id ?? null,
    name: lineItem.name,
    itemCode: lineItem.itemCode ?? null,
    note: lineItem.note ?? null,
    quantity,
    unitName: lineItem.unitName ?? null,
    unitPriceCents: lineItem.price,
    baseAmountCents,
    modifierAmountCents,
    grossAmountCents,
    discountAmountCents,
    netAmountCents,
    modifiers,
    discounts,
    taxes,
    refunded: lineItem.refunded ?? false,
    exchanged: lineItem.exchanged ?? false,
  });
}

export function normalizeCloverRefund(
  untrustedRefund: unknown,
  untrustedContext: CloverNormalizationContext,
): NormalizedRefund {
  const refund = CloverRefundSchema.parse(untrustedRefund);
  const context = normalizeContext(untrustedContext);
  const tipAmountCents = refund.tipAmount ?? 0;
  const taxAmountCents = refund.taxAmount ?? 0;

  return NormalizedRefundSchema.parse({
    externalId: refund.id,
    merchantId: context.merchantId,
    orderExternalId: refund.orderRef?.id ?? null,
    paymentExternalId: refund.payment?.id ?? null,
    externalReferenceId: refund.externalReferenceId ?? null,
    currency: context.currency,
    amountCents: refund.amount,
    subtotalAmountCents: Math.max(
      0,
      refund.amount - taxAmountCents - tipAmountCents,
    ),
    taxAmountCents,
    tipAmountCents,
    occurredAt: isoTimestamp(refund.createdTime),
    lineItemExternalIds: collectionElements(refund.lineItems).map(
      (lineItem) => lineItem.id,
    ),
    tender: refund.overrideMerchantTender
      ? normalizeTender(refund.overrideMerchantTender)
      : null,
    sourceChannel: context.sourceChannel,
  });
}

export function normalizeCloverPayment(
  untrustedPayment: unknown,
  untrustedContext: CloverNormalizationContext,
): NormalizedPayment {
  const payment = CloverPaymentSchema.parse(untrustedPayment);
  const context = normalizeContext(untrustedContext);
  const sourceChannel =
    context.sourceChannel === "unknown"
      ? sourceFromText(textCandidate([payment.sourceChannel, payment.source]))
      : context.sourceChannel;
  const refundContext = { ...context, sourceChannel };
  const refunds = collectionElements(payment.refunds).map((refund) =>
    normalizeCloverRefund(refund, refundContext),
  );
  const tipAmountCents = payment.tipAmount ?? 0;
  const taxAmountCents = payment.taxAmount ?? 0;
  const totalCollectedCents = sumCents([payment.amount, tipAmountCents]);
  const refundedAmountCents = sumCents(
    refunds.map((refund) => refund.amountCents),
  );

  return NormalizedPaymentSchema.parse({
    externalId: payment.id,
    merchantId: context.merchantId,
    orderExternalId: payment.order?.id ?? null,
    externalPaymentId: payment.externalPaymentId ?? null,
    currency: context.currency,
    status: payment.result.toUpperCase(),
    amountCents: payment.amount,
    subtotalAmountCents: Math.max(0, payment.amount - taxAmountCents),
    taxAmountCents,
    tipAmountCents,
    serviceChargeAmountCents: Math.max(0, payment.serviceCharge?.amount ?? 0),
    additionalChargeAmountCents: sumCents(
      collectionElements(payment.additionalCharges).map((charge) =>
        Math.max(0, charge.amount ?? 0),
      ),
    ),
    totalCollectedCents,
    refundedAmountCents,
    netCollectedCents: totalCollectedCents - refundedAmountCents,
    occurredAt: isoTimestamp(payment.createdTime),
    modifiedAt:
      payment.modifiedTime === undefined
        ? null
        : isoTimestamp(payment.modifiedTime),
    offline: payment.offline ?? false,
    tender: normalizeTender(payment.tender, payment.cardTransaction?.cardType),
    taxes: collectionElements(payment.taxRates).map(normalizeTax),
    refunds,
    sourceChannel,
  });
}

export function isCloverSuccessfulPayment(
  payment: Pick<NormalizedPayment, "status">,
): boolean {
  return payment.status === "SUCCESS";
}

export function normalizeCloverOrder(
  untrustedOrder: unknown,
  untrustedContext: CloverOrderNormalizationContext,
): NormalizedOrder {
  const order = CloverOrderSchema.parse(untrustedOrder);
  const merchantId = CloverIdSchema.parse(untrustedContext.merchantId);
  const inferredSource = inferCloverSourceChannel(order);
  const sourceChannel =
    untrustedContext.sourceChannel === undefined
      ? inferredSource.channel
      : NormalizedSourceChannelSchema.parse(untrustedContext.sourceChannel);
  const context = {
    merchantId,
    currency: order.currency,
    sourceChannel,
  };

  const lineItems = collectionElements(order.lineItems).map((lineItem) =>
    normalizeCloverLineItem(lineItem),
  );
  const discounts = collectionElements(order.discounts).map((discount) =>
    normalizeDiscount(discount, "order"),
  );
  const payments = collectionElements(order.payments).map((payment) =>
    normalizeCloverPayment(payment, context),
  );

  const refundsById = new Map<string, NormalizedRefund>();
  for (const refund of collectionElements(order.refunds)) {
    const normalized = normalizeCloverRefund(refund, context);
    refundsById.set(normalized.externalId, normalized);
  }
  for (const payment of payments) {
    for (const refund of payment.refunds) {
      refundsById.set(refund.externalId, refund);
    }
  }
  const refunds = [...refundsById.values()];
  const successfulPayments = payments.filter(isCloverSuccessfulPayment);

  const paymentAmountCents = sumCents(
    successfulPayments.map((payment) => payment.amountCents),
  );
  const tipAmountCents = sumCents(
    successfulPayments.map((payment) => payment.tipAmountCents),
  );
  const refundAmountCents = sumCents(
    refunds.map((refund) => refund.amountCents),
  );
  const lineItemGrossCents = sumCents(
    lineItems.map((lineItem) => lineItem.grossAmountCents),
  );
  const lineItemNetCents = sumCents(
    lineItems.map((lineItem) => lineItem.netAmountCents),
  );
  const lineItemDiscountCents = sumCents(
    lineItems.map((lineItem) => lineItem.discountAmountCents),
  );
  const itemizedLineDiscountCents = sumCents(
    lineItems.flatMap((lineItem) =>
      lineItem.discounts
        .filter((discount) => discount.scope === "line_item")
        .map((discount) => discount.amountCents ?? 0),
    ),
  );
  const orderFixedDiscountCents = sumCents(
    discounts.map((discount) => discount.amountCents ?? 0),
  );
  const knownDiscountCents = sumCents([
    itemizedLineDiscountCents,
    orderFixedDiscountCents,
  ]);
  const paymentTaxes = aggregateTaxes(
    successfulPayments.flatMap((payment) => payment.taxes),
  );
  const taxes =
    paymentTaxes.length > 0
      ? paymentTaxes
      : aggregateTaxes(lineItems.flatMap((lineItem) => lineItem.taxes));
  const taxAmountCents =
    successfulPayments.length > 0
      ? sumCents(
          successfulPayments.map((payment) => payment.taxAmountCents),
        )
      : sumCents(taxes.map((tax) => tax.amountCents));

  return NormalizedOrderSchema.parse({
    externalId: order.id,
    merchantId,
    externalReferenceId: order.externalReferenceId ?? null,
    currency: order.currency,
    state: order.state ?? null,
    paymentState: order.paymentState ?? null,
    title: order.title ?? null,
    note: order.note ?? null,
    totalCents: order.total,
    lineItemGrossCents,
    lineItemNetCents,
    discountAmountCents:
      lineItems.length > 0
        ? Math.max(lineItemDiscountCents, knownDiscountCents)
        : orderFixedDiscountCents,
    paymentAmountCents,
    tipAmountCents,
    taxAmountCents,
    refundAmountCents,
    netCollectedCents:
      sumCents([paymentAmountCents, tipAmountCents]) - refundAmountCents,
    createdAt: isoTimestamp(order.createdTime),
    modifiedAt:
      order.modifiedTime === undefined
        ? null
        : isoTimestamp(order.modifiedTime),
    sourceChannel,
    sourceChannelRaw: inferredSource.raw,
    lineItems,
    discounts,
    taxes,
    payments,
    refunds,
  });
}
