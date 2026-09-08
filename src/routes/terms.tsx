import { createFileRoute, Link } from "@tanstack/react-router";
import {
  LEGAL_EFFECTIVE,
  LegalDocument,
  LegalSection,
} from "@/components/marketing/LegalDocument";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service · Summex" },
      {
        name: "description",
        content:
          "Terms of Service for Summex, operated by Quantum Reach. Software, Quantum Payments on Finix, hardware, fees, and subscriber responsibilities.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalDocument kicker="LEGAL" title="Terms of Service" page="terms">
      <LegalSection title="1. Agreement">
        <p>
          These Terms of Service (the “Terms”) are a contract between Quantum
          Reach, operating the Summex products (“Quantum Reach,” “Summex,” “we,”
          “us,” or “our”), and the subscriber business that uses the service
          (“you,” “your,” or the “Subscriber”). If you accept on behalf of a
          company, you represent that you have authority to bind that company.
        </p>
        <p>
          By signing a quote or order, creating an owner account, or using
          Summex, you agree to these Terms, the{" "}
          <Link to="/privacy" className="text-champagne hover:underline">
            Privacy Policy
          </Link>
          , and any signed order, quote, or statement of work. Card processing
          is a separate relationship: each selling operator is a Finix merchant
          and must accept Finix’s merchant terms. These pages describe the
          product as offered. They are not legal advice to you; consult your
          own counsel for your business, tax, alcohol, employment, and
          cash-discount rules.
        </p>
      </LegalSection>

      <LegalSection title="2. The service">
        <p>
          Summex is hospitality software: point of sale and related modules
          (floor, order display / ODS, guest kiosk and waitlist, gift ledger,
          labor, and reporting). We may add, change, or retire modules. What
          you receive is what your signed package and location settings enable.
        </p>
        <p>
          Staff stations are Android tablets running the Summex Station app.
          After the owner pairs a device, the tablet opens on a staff PIN pad —
          not the marketing site and not the owner login. Guest QR pay and
          order is a hosted page for the guest. It is not a staff station and
          does not use a staff PIN.
        </p>
      </LegalSection>

      <LegalSection title="3. Payments">
        <p>
          Guest cards are processed as Quantum Payments on Finix. We are not a
          bank, money transmitter, or card network. We do not hold guest
          settlement funds. Each selling operator (a single shop, a host brand
          that sells, or a tenant / peer operator on a shared check) is its own
          Finix merchant, completes Finix’s application, and accepts Finix’s
          then-current merchant terms and prohibited-business rules (including{" "}
          <a
            href="https://finix-hosted-content.s3.amazonaws.com/flex/v2/finix-terms-of-service.html"
            className="text-champagne hover:underline"
            rel="noreferrer"
            target="_blank"
          >
            Finix Merchant Terms of Service
          </a>{" "}
          and Finix’s prohibited and restricted businesses list).
        </p>
        <p>
          The guest tenders once. On a split check, settlement follows the
          owner of each line: capture splits to each selling merchant; the
          receipt still itemizes by vendor. Cash-discount programs, service
          charges, and autogratuity are configured by the venue. You are
          responsible for posting, signage, and local law. Summex does not
          rewrite legal copy per state.
        </p>
        <p>
          Chargebacks, disputes, and network fines follow the selling
          merchant(s) on the check. Where more than one merchant’s merchandise
          is on a disputed check, allocation follows merchandise share as
          described in the product. Software invoices are a separate bill from
          card processing unless you have signed a bundled plan that says
          otherwise.
        </p>
      </LegalSection>

      <LegalSection title="4. Hardware">
        <p>
          You supply Android tablets, printers, cash drawers, and stands.
          Summex is the software; it does not sell a general hardware kit.
          Card-present readers for live Quantum Payments are Finix / Quantum
          units supplied through us (typically drop-shipped to the site).
          Third-party terminals (including Square, Stripe, or bank terminals
          you already own) are not supported for guest cards on Summex.
        </p>
      </LegalSection>

      <LegalSection title="5. Fees">
        <p>
          You pay the monthly software fees in your signed quote or order,
          optional setup if quoted, itemized reader hardware when ordered
          through us, and SMS overage at cost after the included allotment
          (or you may cap and stop). Processing fees, interchange, and
          dispute fees are billed in the payments relationship, not as SaaS,
          unless a bundled plan is signed.
        </p>
        <p>
          Unpaid software fees may result in suspension of owner tools or the
          service after notice. Card processing may be paused independently by
          Finix or by us when a merchant is not approved, a reader is not
          enrolled, or use violates these Terms or Finix’s rules.
        </p>
      </LegalSection>

      <LegalSection title="6. Onboarding and go-live">
        <p>
          After the contract is signed, you receive owner login and complete{" "}
          <em>your</em> setup: menu, floor, staff PINs, devices, and tax. We
          may provide training materials and a sandbox. Training and sandbox
          card processing are not live card processing and must not be treated
          as a live Visa or bank settlement.
        </p>
        <p>
          Go-live is your action. Live cards also require approved merchant
          account(s) and enrolled reader(s). Opening the house before those
          exist does not make us a processor or a bank.
        </p>
      </LegalSection>

      <LegalSection title="7. Accounts and your responsibilities">
        <p>
          Owner login (email or username and password on the console) is
          distinct from staff PIN on a station. PIN is not clock-in and not
          closeout. You are responsible for who you give a PIN, for rotating
          and locking PINs, and for what staff do on the floor.
        </p>
        <p>You are solely responsible for:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Tax collection, filing, and remittance for your sales.</li>
          <li>
            Alcohol service, licensing, age checks, and hours — we are not
            your liquor license.
          </li>
          <li>
            Employment law, wages, tips, payroll filing, and how you use
            labor, scheduling, and export tools. Summex does not process
            payroll.
          </li>
          <li>
            Menu content, prices, allergens, cash-discount and service-charge
            posting, and what you print or display to guests.
          </li>
          <li>
            Keeping owner credentials and staff PINs confidential. You must
            not store primary account numbers (PAN) or CVV in email, chat,
            tickets, or notes.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Gift cards">
        <p>
          Gift cards and stored value on Summex are an internal house ledger
          (swipe, scan, or key). They are not issued or held by Finix. Load
          and redeem happen inside Summex. Unredeemed balances, breakage, and
          expiry follow applicable state law. We are not your escheat or
          unclaimed-property agent unless a later written agreement says so.
          You remain the issuer of record for cards you load.
        </p>
      </LegalSection>

      <LegalSection title="9. Data">
        <p>
          You own your venue operational data (menus, tickets, staff records
          you enter, gift ledger, and reports for your house). We process that
          data to provide the service, as described in the{" "}
          <Link to="/privacy" className="text-champagne hover:underline">
            Privacy Policy
          </Link>
          . You grant us a limited license to host, copy, and display that
          data solely to operate Summex for you.
        </p>
      </LegalSection>

      <LegalSection title="10. Acceptable use">
        <p>You will not, and will not allow staff or operators to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Process payments for a business we or Finix prohibit or have not
            approved, or for a merchant identity that is not the seller of
            the goods or services.
          </li>
          <li>
            Store, email, or paste PAN, full track data, or CVV in Summex
            notes, email, chat, or exports.
          </li>
          <li>
            Probe, overload, or reverse engineer the service except as
            allowed by law; resell Summex without our written consent; or
            use the service to break the law.
          </li>
        </ul>
        <p>
          We may suspend processing or access when we reasonably believe these
          rules, Finix’s rules, or law are at risk.
        </p>
      </LegalSection>

      <LegalSection title="11. Intellectual property">
        <p>
          Summex, Quantum Payments, related marks, and the software are owned
          by Quantum Reach or its licensors. These Terms do not transfer
          ownership. You keep ownership of your menus, marks, and operational
          data. Feedback you send may be used to improve the service without
          obligation.
        </p>
      </LegalSection>

      <LegalSection title="12. Disclaimer — as-is SaaS">
        <p>
          The service is provided “as is” and “as available.” To the fullest
          extent permitted by law, we disclaim warranties of merchantability,
          fitness for a particular purpose, title, and non-infringement. We
          do not warrant uninterrupted or error-free operation, that sandbox
          behavior equals live processing, or that the software will satisfy
          your tax, alcohol, cash-discount, tip, or employment obligations.
          Hardware you supply is your equipment.
        </p>
      </LegalSection>

      <LegalSection title="13. Limitation of liability">
        <p>
          To the fullest extent permitted by law, Quantum Reach and its
          principals, contractors, and suppliers will not be liable for
          indirect, incidental, special, consequential, exemplary, or lost
          profits damages, or for lost data, lost tips, chargebacks, or
          business interruption, even if advised of the possibility.
        </p>
        <p>
          Our aggregate liability under these Terms is limited to the software
          fees you paid us in the twelve (12) months before the claim (not
          including amounts Finix settles to merchants, hardware at cost, or
          SMS at cost). Some jurisdictions do not allow certain limits; in
          those places the limit applies to the maximum extent allowed.
        </p>
      </LegalSection>

      <LegalSection title="14. Indemnity">
        <p>
          You will defend and indemnify Quantum Reach and its people against
          claims, damages, and costs (including reasonable attorneys’ fees)
          arising from: your menus and guest-facing copy; your tax, alcohol,
          employment, or cash-discount practices; staff PIN misuse; gift-card
          escheat or issuer obligations; processing for a prohibited or
          unapproved business; your violation of these Terms or Finix’s
          merchant terms; or personal data you collect from guests beyond
          what the service requires.
        </p>
      </LegalSection>

      <LegalSection title="15. Term and termination">
        <p>
          These Terms start when you first accept them and continue until the
          account is closed. You may stop using the service and request
          account closure through support. We may suspend or terminate for
          material breach, unpaid fees, prohibited use, Finix or network
          instruction, or legal requirement, with notice where reasonably
          practicable.
        </p>
        <p>
          After termination, sections that by nature should survive (fees
          owed, gift-issuer obligations, chargebacks, indemnity, limitation
          of liability, and governing law) remain in effect. We retain records
          as described in the Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection title="16. Changes to these Terms">
        <p>
          We may update these Terms. The effective date at the top will
          change. We will give notice (email to the owner account and/or a
          notice in the console) before material changes take effect.
          Continued use after the new effective date is acceptance. If you
          do not agree, you must stop using the service and close the account.
        </p>
      </LegalSection>

      <LegalSection title="17. Governing law">
        <p>
          These Terms are governed by the laws of the State of Oregon, United
          States, without regard to conflict-of-law rules. Exclusive venue
          for disputes that are not resolved informally is the state or
          federal courts located in Oregon, unless applicable law requires
          otherwise. The U.N. Convention on Contracts for the International
          Sale of Goods does not apply.
        </p>
      </LegalSection>

      <LegalSection title="18. General">
        <p>
          These Terms, the Privacy Policy, and your signed quote or order are
          the entire agreement for the software. Finix’s merchant terms govern
          card processing. If a provision is unenforceable, the rest remains
          in effect. You may not assign the account without our consent,
          except to a successor of your business. We may assign to an
          affiliate or in connection with a sale of the product line. Failure
          to enforce a provision is not a waiver.
        </p>
      </LegalSection>

      <LegalSection title="19. Contact">
        <p>
          Quantum Reach · Summex
          <br />
          Email:{" "}
          <a
            href="mailto:support@summex.app"
            className="text-champagne hover:underline"
          >
            support@summex.app
          </a>
          <br />
          Site:{" "}
          <a href="https://summex.app" className="text-champagne hover:underline">
            summex.app
          </a>
        </p>
        <p className="text-xs">
          Last revised {LEGAL_EFFECTIVE}. These Terms describe the product for
          subscribers and payment partners. They are not a substitute for
          advice from your counsel.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
