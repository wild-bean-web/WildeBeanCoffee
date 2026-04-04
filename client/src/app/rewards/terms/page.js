import Link from "next/link";
import { LOYALTY_FREE_ITEM_MAX_PRE_TAX } from "@/lib/loyaltyConstants";

export const metadata = {
  title: "Bean Stamps Terms | Wild Bean Coffee",
  description: "Terms for the Wild Bean Coffee Bean Stamps online rewards program.",
};

export default function BeanStampsTermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-md">
        <Link
          href="/rewards"
          className="text-sm font-medium text-[var(--coffee-brown)] underline"
        >
          ← Back to Bean Stamps
        </Link>
        <h1 className="mt-6 text-3xl font-bold text-[var(--coffee-brown)]">
          Bean Stamps — Program Terms
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Last updated: {new Date().toLocaleDateString("en-US", { dateStyle: "long" })}
        </p>
        <p className="mt-6 text-sm text-gray-600">
          These terms describe how the Bean Stamps loyalty program works for{" "}
          <strong>online orders</strong> placed through Wild Bean Coffee’s
          website. They are not a substitute for legal advice; Wild Bean Coffee
          may update this program and these terms with reasonable notice where
          required.
        </p>

        <section className="mt-8 space-y-4 text-sm text-gray-800">
          <h2 className="text-lg font-bold text-[var(--coffee-brown)]">
            1. Eligibility
          </h2>
          <ul className="list-inside list-disc space-y-2">
            <li>
              You must have a registered account and be signed in when placing
              an order to earn or redeem Bean Stamps. Guest checkout does not
              participate.
            </li>
            <li>
              The program applies only to orders placed through our online
              ordering flow, not in-store POS purchases unless we state otherwise.
            </li>
          </ul>

          <h2 className="text-lg font-bold text-[var(--coffee-brown)]">
            2. Earning stamps
          </h2>
          <ul className="list-inside list-disc space-y-2">
            <li>
              One stamp may be earned per qualifying order. A qualifying order is
              one that is successfully paid online with{" "}
              <strong>payment status &quot;paid&quot;</strong>, is not cancelled
              as described below, and has an <strong>order total of at least $10.00
              including tax</strong> after all discounts (including any reward
              applied on that order).
            </li>
            <li>
              If you have <strong>20 stamps</strong> and a reward is ready,{" "}
              <strong>no additional stamps</strong> are earned until you redeem the
              reward on a completed order (your progress bar is frozen at full).
            </li>
            <li>
              <strong>Refunds:</strong> If an order qualified and a stamp was
              already recorded, <strong>later partial or full refunds do not
              remove</strong> that stamp.
            </li>
            <li>
              <strong>Cancellations:</strong> If an order is marked{" "}
              <strong>cancelled</strong> in our system, any stamp tied to that
              order may be <strong>revoked</strong> so the program stays fair.
            </li>
            <li>
              Wild Bean Coffee reserves the right to adjust or remove stamps or
              rewards in cases of error, abuse, fraud, duplicate accounts, or
              technical issues.
            </li>
          </ul>

          <h2 className="text-lg font-bold text-[var(--coffee-brown)]">
            3. Redeeming a reward
          </h2>
          <p className="text-sm text-gray-800">
            We may describe the benefit in marketing or on the website as{" "}
            <strong>up to ${LOYALTY_FREE_ITEM_MAX_PRE_TAX} off your pick</strong>.
            For these terms, <strong>your pick</strong> means the{" "}
            <strong>single menu item entry</strong> in your online shopping cart
            that you designate at checkout to apply your reward—the same entry
            shown as one row in your order summary, including the{" "}
            <strong>quantity</strong> and <strong>customizations</strong> (e.g.
            modifiers) displayed for that entry.
          </p>
          <ul className="mt-4 list-inside list-disc space-y-2">
            <li>
              <strong>Discount amount (pre-tax):</strong> The reward reduces the
              pre-tax price of your pick by up to{" "}
              <strong>${LOYALTY_FREE_ITEM_MAX_PRE_TAX.toFixed(2)}</strong> (or
              such other maximum as we publish on the website). The pre-tax
              price of your pick is calculated as{" "}
              <strong>
                (base unit price + per-unit customizations) × quantity
              </strong>{" "}
              for that entry, as determined in our checkout.
            </li>
            <li>
              <strong>Cap:</strong> If that pre-tax total is{" "}
              <strong>less than</strong> ${LOYALTY_FREE_ITEM_MAX_PRE_TAX.toFixed(2)}
              , the discount equals that total. If it is{" "}
              <strong>greater than</strong> ${LOYALTY_FREE_ITEM_MAX_PRE_TAX.toFixed(2)}
              , the discount is <strong>capped</strong> at $
              {LOYALTY_FREE_ITEM_MAX_PRE_TAX.toFixed(2)}; you pay the remainder of
              your pick’s pre-tax amount, and <strong>sales tax</strong> is
              calculated on the order as a whole in accordance with our checkout
              (after application of the discount).
            </li>
            <li>
              At 20 stamps, you may apply <strong>one such reward per checkout</strong>
              .
            </li>
            <li>
              Using the reward on an order <strong>resets your stamp progress</strong>{" "}
              for the next cycle. You cannot stack multiple unused rewards; you
              must redeem to keep earning stamps again.
            </li>
            <li>
              Rewards have <strong>no cash value</strong>, are not transferable,
              and cannot be sold.
            </li>
          </ul>

          <h2 className="text-lg font-bold text-[var(--coffee-brown)]">
            4. Changes & termination
          </h2>
          <p>
            We may modify or end Bean Stamps, change thresholds or benefits, or
            exclude certain products. We will use reasonable efforts to communicate
            material changes. If the program ends, we may specify how unused
            rewards are handled at that time.
          </p>

          <h2 className="text-lg font-bold text-[var(--coffee-brown)]">
            5. Contact
          </h2>
          <p>
            Questions about Bean Stamps? Contact us using the information on our
            website or at the store.
          </p>
        </section>
      </div>
    </div>
  );
}
