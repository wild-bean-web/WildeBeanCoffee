export const fixtureMerchantId = "MERCHANT123";
export const fixtureSigningSecret = "hcp_fixture_signing_secret_123456";

export const platformWebhookFixture = {
  appId: "APP123",
  merchants: {
    [fixtureMerchantId]: [
      {
        objectId: "O:ORDER123",
        type: "UPDATE",
        ts: Date.parse("2026-09-17T15:00:00.000Z"),
      },
      {
        objectId: "P:PAYMENT123",
        type: "CREATE",
        ts: Date.parse("2026-09-17T15:01:00.000Z"),
      },
    ],
  },
} as const;

export const hostedCheckoutWebhookFixture = {
  createdTime: Date.parse("2026-09-17T15:01:00.000Z"),
  message: "Approved for 1361",
  status: "APPROVED",
  type: "PAYMENT",
  id: "PAYMENT123",
  merchantId: fixtureMerchantId,
  data: "CHECKOUT123",
} as const;

export const cloverRefundFixture = {
  id: "REFUND123",
  orderRef: { id: "ORDER123" },
  payment: { id: "PAYMENT123" },
  amount: 400,
  taxAmount: 30,
  tipAmount: 50,
  createdTime: Date.parse("2026-09-17T16:00:00.000Z"),
  externalReferenceId: "manager-refund-1",
  lineItems: [{ id: "LINE1" }],
} as const;

export const cloverPaymentFixture = {
  id: "PAYMENT123",
  order: { id: "ORDER123" },
  tender: {
    id: "TENDER_CARD",
    labelKey: "com.clover.tender.credit_card",
    label: "Credit Card",
  },
  amount: 1161,
  tipAmount: 200,
  taxAmount: 86,
  externalPaymentId: "external-payment-1",
  createdTime: Date.parse("2026-09-17T15:30:00.000Z"),
  modifiedTime: Date.parse("2026-09-17T15:31:00.000Z"),
  offline: false,
  result: "SUCCESS",
  cardTransaction: {
    cardType: "VISA",
    entryType: "EMV_CONTACTLESS",
  },
  serviceCharge: {
    id: "SERVICE1",
    name: "Service charge",
    amount: 0,
  },
  additionalCharges: {
    elements: [
      {
        id: "CHARGE1",
        type: "CONVENIENCE_FEE",
        amount: 25,
      },
    ],
  },
  taxRates: {
    elements: [
      {
        id: "TAX1",
        name: "Sales tax",
        rate: 800000,
        taxableAmount: 1075,
        taxAmount: 86,
        isVat: false,
      },
    ],
  },
  refunds: {
    elements: [cloverRefundFixture],
  },
} as const;

export const failedCloverPaymentFixture = {
  id: "PAYMENT_FAILED",
  order: { id: "ORDER_FAILED" },
  tender: {
    id: "TENDER_CASH",
    label: "Cash",
  },
  amount: 500,
  tipAmount: 0,
  taxAmount: 0,
  createdTime: Date.parse("2026-09-17T17:00:00.000Z"),
  result: "FAIL",
} as const;

export const cloverOrderFixture = {
  id: "ORDER123",
  currency: "usd",
  total: 1161,
  externalReferenceId: "web-order-42",
  paymentState: "PARTIALLY_REFUNDED",
  title: "Web order 42",
  note: "Leave at counter",
  orderType: {
    id: "ORDER_TYPE_ONLINE",
    labelKey: "online_order",
    label: "Online",
    systemOrderTypeId: "ONLINE",
  },
  state: "locked",
  createdTime: Date.parse("2026-09-17T15:00:00.000Z"),
  modifiedTime: Date.parse("2026-09-17T16:01:00.000Z"),
  discounts: {
    elements: [
      {
        id: "ORDER_DISCOUNT1",
        name: "Loyalty",
        amount: -50,
      },
    ],
  },
  lineItems: {
    elements: [
      {
        id: "LINE1",
        item: { id: "ITEM_LATTE" },
        name: "Latte",
        itemCode: "LATTE",
        note: "Extra hot",
        price: 500,
        priceWithModifiers: 575,
        priceWithModifiersAndItemAndOrderDiscounts: 475,
        modifications: {
          elements: [
            {
              id: "MODIFICATION1",
              name: "Oat milk",
              amount: 75,
              modifier: {
                id: "MODIFIER_OAT",
                name: "Oat milk",
                price: 75,
                modifierGroup: { id: "MODIFIER_GROUP_MILK" },
              },
            },
          ],
        },
        discounts: {
          elements: [
            {
              id: "LINE_DISCOUNT1",
              name: "Happy hour",
              amount: -50,
            },
          ],
        },
        orderLevelDiscounts: {
          elements: [
            {
              id: "ATTRIBUTED_ORDER_DISCOUNT1",
              name: "Loyalty",
              amount: -50,
            },
          ],
        },
        discountAmount: -50,
        orderLevelDiscountAmount: -50,
        taxRates: [
          {
            id: "TAX1",
            name: "Sales tax",
            rate: 800000,
            taxableAmount: 475,
            taxAmount: 38,
          },
        ],
      },
      {
        id: "LINE2",
        item: { id: "ITEM_BEANS" },
        name: "Coffee beans",
        price: 400,
        unitQty: 1500,
        unitName: "lb",
        priceWithModifiers: 600,
        priceWithModifiersAndItemAndOrderDiscounts: 600,
        taxRates: {
          elements: [
            {
              id: "TAX1",
              name: "Sales tax",
              rate: 800000,
              taxableAmount: 600,
              taxAmount: 48,
            },
          ],
        },
      },
    ],
  },
  payments: {
    elements: [cloverPaymentFixture],
  },
  refunds: {
    elements: [cloverRefundFixture],
  },
} as const;
