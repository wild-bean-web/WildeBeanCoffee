"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function TermsOfUsePage() {
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-lg bg-white p-8 shadow-md"
        >
          <h1 className="mb-4 text-4xl font-bold text-[var(--coffee-brown)]">
            Terms of Use
          </h1>
          <p className="mb-8 text-sm text-gray-600">
            Last updated: {currentDate}
          </p>

          <div className="prose prose-lg max-w-none space-y-8 text-gray-700">
            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--coffee-brown)]">
                1. Agreement to Terms
              </h2>
              <p className="mb-4 leading-relaxed">
                These Terms of Use ("Terms") constitute a legally binding agreement between you and Wild Bean Coffee LLC ("Wild Bean Coffee," "we," "us," or "our") governing your access to and use of our website at wildbeancoffeeshop.com (the "Site") and our online ordering and related services (collectively, the "Services"). By accessing or using the Site or Services, you agree to be bound by these Terms. If you do not agree to these Terms, you may not access or use the Site or Services.
              </p>
              <p className="leading-relaxed">
                We may update these Terms from time to time. The "Last updated" date at the top of this page indicates when the Terms were last revised. Your continued use of the Site or Services after any changes constitutes your acceptance of the revised Terms. We encourage you to review these Terms periodically.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--coffee-brown)]">
                2. Description of Services
              </h2>
              <p className="mb-4 leading-relaxed">
                Our Site allows you to browse our menu, customize orders, and place orders for pickup. <strong>Ordering is conducted through our website.</strong> Payment for orders is processed by a third-party payment processor, Clover (Clover Network, LLC). When you complete a purchase, you are agreeing to our ordering terms and to Clover's payment terms and processing. We do not store your full payment card details on our servers; payment data is handled by Clover in accordance with their policies and applicable payment card industry standards.
              </p>
              <p className="leading-relaxed">
                We reserve the right to modify, suspend, or discontinue the Site or any part of the Services at any time, with or without notice.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--coffee-brown)]">
                3. Eligibility
              </h2>
              <p className="mb-4 leading-relaxed">
                You must be at least 18 years of age (or the age of majority in your jurisdiction) and have the legal capacity to enter into a binding agreement to use our Services. By using the Site or Services, you represent and warrant that you meet these requirements. If you are using the Site or Services on behalf of an organization, you represent that you have authority to bind that organization to these Terms.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--coffee-brown)]">
                4. Your Obligations and Acceptable Use
              </h2>
              <p className="mb-4 leading-relaxed">
                You agree to use the Site and Services only for lawful purposes and in accordance with these Terms. You agree not to:
              </p>
              <ul className="mb-4 ml-6 list-disc space-y-2">
                <li>Use the Site or Services in any way that violates applicable laws or regulations</li>
                <li>Impersonate or attempt to impersonate Wild Bean Coffee, a Wild Bean Coffee employee, another user, or any other person or entity</li>
                <li>Transmit any virus, malware, or other harmful or malicious code</li>
                <li>Attempt to gain unauthorized access to any part of the Site, our systems, or the systems of our service providers (including Clover)</li>
                <li>Use the Site or Services to harass, abuse, or harm another person</li>
                <li>Use automated means (e.g., bots, scrapers) to access the Site or Services without our prior written consent</li>
                <li>Interfere with or disrupt the integrity or performance of the Site or Services</li>
              </ul>
              <p className="leading-relaxed">
                We reserve the right to refuse service, cancel orders, or terminate or restrict your access to the Site or Services if we believe you have violated these Terms or for any other reason at our discretion.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--coffee-brown)]">
                5. Orders and Payment
              </h2>
              <h3 className="mb-3 text-xl font-semibold text-[var(--coffee-brown)]">
                5.1 Placing Orders
              </h3>
              <p className="mb-4 leading-relaxed">
                Orders placed through our Site are offers to purchase products for pickup at our location. We reserve the right to accept or decline any order for any reason, including product availability, errors in pricing or product information, or suspected fraud. Order confirmation (by email or on-screen) does not guarantee acceptance; we may contact you to verify or cancel an order.
              </p>
              <h3 className="mb-3 text-xl font-semibold text-[var(--coffee-brown)]">
                5.2 Payment Processing (Clover)
              </h3>
              <p className="mb-4 leading-relaxed">
                Payment for online orders is processed by <strong>Clover (Clover Network, LLC)</strong>. By completing a purchase, you agree to provide current, complete, and accurate payment and contact information. You authorize us and Clover to charge your selected payment method for the total amount of your order (including applicable taxes and fees) at the time of or in connection with your order. All payments are subject to Clover's terms and conditions and privacy policy. We are not responsible for the performance, availability, or security of Clover's systems. Disputes regarding payment processing may need to be addressed with Clover or your card issuer in accordance with their policies.
              </p>
              <h3 className="mb-3 text-xl font-semibold text-[var(--coffee-brown)]">
                5.3 Pricing and Availability
              </h3>
              <p className="mb-4 leading-relaxed">
                We strive to display accurate pricing and product information. We do not warrant that descriptions, pricing, or other content on the Site are accurate, complete, or current. We reserve the right to correct errors and to change or update information at any time. If an order is placed at an incorrect price due to an error, we may cancel the order or contact you to confirm the correct price.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--coffee-brown)]">
                6. Food Allergen and Cross-Contamination Notice
              </h2>
              <p className="mb-4 leading-relaxed">
                Many of our menu items contain or may contain allergens (including but not limited to dairy, eggs, tree nuts, peanuts, wheat/gluten, soy, and coconut). We provide allergen information on our menu and in product descriptions for general customer awareness only. This information may not be complete or current, and we do not guarantee its accuracy.
              </p>
              <p className="mb-4 leading-relaxed">
                <strong>Cross-contamination is possible in our establishment.</strong> We use shared equipment, prep areas, and storage. We cannot guarantee that any item is free of any particular allergen or that it has not come into contact with allergens during preparation, handling, or serving. If you have a food allergy or sensitivity, you should be aware of these risks and make your own decision about ordering. We do not assume any liability for allergic reactions or other adverse effects resulting from consumption of our products.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--coffee-brown)]">
                7. Intellectual Property
              </h2>
              <p className="mb-4 leading-relaxed">
                The Site and its entire contents, features, and functionality (including but not limited to text, graphics, logos, images, and software) are owned by Wild Bean Coffee or its licensors and are protected by United States and international copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, sell, or create derivative works from any part of the Site or our content without our prior written consent.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--coffee-brown)]">
                8. Disclaimers
              </h2>
              <p className="mb-4 leading-relaxed">
                THE SITE AND SERVICES ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR COURSE OF PERFORMANCE. WE DO NOT WARRANT THAT THE SITE OR SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS. WE DO NOT CONTROL AND ARE NOT RESPONSIBLE FOR THE AVAILABILITY, CONTENT, OR CONDUCT OF THIRD-PARTY SERVICES SUCH AS CLOVER.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--coffee-brown)]">
                9. Limitation of Liability
              </h2>
              <p className="mb-4 leading-relaxed">
                TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, WILD BEAN COFFEE AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, USE, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SITE OR SERVICES, WHETHER BASED ON WARRANTY, CONTRACT, TORT (INCLUDING NEGLIGENCE), OR ANY OTHER LEGAL THEORY, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
              </p>
              <p className="mb-4 leading-relaxed">
                IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATED TO THE SITE OR SERVICES EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID TO US IN THE TWELVE (12) MONTHS PRIOR TO THE EVENT GIVING RISE TO THE CLAIM, OR (B) ONE HUNDRED DOLLARS ($100 USD).
              </p>
              <p className="leading-relaxed">
                Some jurisdictions do not allow the exclusion or limitation of certain damages; in such jurisdictions, the above limitations may not apply to you to the extent prohibited by law.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--coffee-brown)]">
                10. Indemnification
              </h2>
              <p className="leading-relaxed">
                You agree to indemnify, defend, and hold harmless Wild Bean Coffee and its officers, directors, employees, agents, and affiliates from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising out of or related to (a) your use of the Site or Services, (b) your violation of these Terms, (c) your violation of any third-party right, or (d) any dispute between you and a third party, including Clover, to the extent arising from your use of the Services.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--coffee-brown)]">
                11. Third-Party Services
              </h2>
              <p className="mb-4 leading-relaxed">
                Our Services may integrate or link to third-party services, including Clover for payment processing. Your use of such third-party services is subject to their respective terms and privacy policies. We are not responsible for the content, privacy practices, or availability of third-party services. Links to third-party sites or services do not constitute our endorsement. Clover's terms and privacy policy are available at{" "}
                <a
                  href="https://www.clover.com/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--lime-green)] underline hover:text-[var(--lime-green-dark)]"
                >
                  clover.com/terms
                </a>{" "}
                and{" "}
                <a
                  href="https://www.clover.com/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--lime-green)] underline hover:text-[var(--lime-green-dark)]"
                >
                  clover.com/privacy-policy
                </a>.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--coffee-brown)]">
                12. Governing Law and Disputes
              </h2>
              <p className="mb-4 leading-relaxed">
                These Terms and any dispute or claim arising out of or related to them or the Site or Services shall be governed by and construed in accordance with the laws of the State in which Wild Bean Coffee operates, without regard to its conflict of law provisions. You agree to submit to the personal and exclusive jurisdiction of the state and federal courts located in that State for the resolution of any disputes.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--coffee-brown)]">
                13. Changes to These Terms
              </h2>
              <p className="leading-relaxed">
                We may revise these Terms at any time. We will post the updated Terms on this page and update the "Last updated" date. Your continued use of the Site or Services after the posting of changes constitutes your acceptance of the revised Terms. If you do not agree to the new Terms, you must stop using the Site and Services.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--coffee-brown)]">
                14. Severability
              </h2>
              <p className="leading-relaxed">
                If any provision of these Terms is held to be invalid or unenforceable by a court of competent jurisdiction, such provision shall be modified to the minimum extent necessary to make it valid and enforceable while preserving the parties' intent, or if modification is not possible, severed from these Terms. The remaining provisions shall remain in full force and effect.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--coffee-brown)]">
                15. Entire Agreement
              </h2>
              <p className="leading-relaxed">
                These Terms, together with our Privacy Policy and any other policies or guidelines we post on the Site, constitute the entire agreement between you and Wild Bean Coffee regarding the Site and Services and supersede any prior agreements.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--coffee-brown)]">
                16. Contact Us
              </h2>
              <p className="mb-4 leading-relaxed">
                If you have questions about these Terms of Use, please contact us:
              </p>
              <ul className="mb-4 ml-6 list-disc space-y-1">
                <li>Wild Bean Coffee LLC</li>
                <li>
                  Email:{" "}
                  <a
                    href="mailto:wildbeancoffeellc@gmail.com"
                    className="text-[var(--lime-green)] underline hover:text-[var(--lime-green-dark)]"
                  >
                    wildbeancoffeellc@gmail.com
                  </a>
                </li>
                <li>
                  Phone:{" "}
                  <a
                    href="tel:+12406456203"
                    className="text-[var(--lime-green)] underline hover:text-[var(--lime-green-dark)]"
                  >
                    +1 240-645-6203
                  </a>
                </li>
                <li>Visit our <Link href="/location" className="text-[var(--lime-green)] underline hover:text-[var(--lime-green-dark)]">Location</Link> page for address, hours, and more contact information</li>
              </ul>
              <p className="leading-relaxed">
                By using our website and online ordering services, you acknowledge that you have read, understood, and agree to be bound by these Terms of Use.
              </p>
            </section>
          </div>

          <div className="mt-10 border-t border-gray-200 pt-6">
            <Link
              href="/"
              className="text-[var(--lime-green)] font-medium hover:text-[var(--lime-green-dark)] underline"
            >
              ← Back to Home
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
