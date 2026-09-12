import { createFileRoute, Link } from "@tanstack/react-router";
import {
  LEGAL_EFFECTIVE,
  LegalDocument,
  LegalSection,
} from "@/components/marketing/LegalDocument";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy · Summex" },
      {
        name: "description",
        content:
          "Privacy Policy for Summex and Quantum Payments, operated by Quantum Reach. How we handle subscriber, staff, guest, and payment data. Card numbers are not stored by Summex.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalDocument kicker="LEGAL" title="Privacy Policy" page="privacy">
      <LegalSection title="1. Who we are">
        <p>
          Quantum Reach operates Summex (hospitality software) and Quantum
          Payments (the guest-card brand on the Finix rail). This policy
          explains how we handle personal information for subscriber
          businesses, their staff, and guests of those businesses. Payment
          card data is handled with Finix as processor and partner — Summex
          does not store PAN or CVV.
        </p>
        <p>
          This policy covers summex.app (marketing), app.summex.app (owner
          console and staff stations), guest QR order/pay pages, kiosk and
          waitlist, and the Summex Station tablet app. It does not make us
          the merchant of record. Each selling operator is a Finix merchant.
        </p>
        <p>
          Related:{" "}
          <Link to="/terms" className="text-champagne hover:underline">
            Terms of Service
          </Link>
          . Contact:{" "}
          <a
            href="mailto:support@summex.app"
            className="text-champagne hover:underline"
          >
            support@summex.app
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="2. What we collect">
        <p>
          <strong className="text-foreground">Subscriber and staff.</strong>{" "}
          Name, email, role, schedule, device pairing (venue and station
          role on a tablet), and staff PIN hashes. We do not put raw PINs
          in logs. Owner login is email or username and password on the
          console — separate from floor PIN.
        </p>
        <p>
          <strong className="text-foreground">Guests.</strong> Only what the
          venue collects through the product: waitlist name, phone, and party
          size; QR order and pay for an open check; reservation last name
          plus a short check-in code; gift-card balance lookup at /gift (card
          number or last four plus PIN — current balance and activity, no staff
          names). We do not sell guest lists. We do not build an advertising
          profile of diners.
        </p>
        <p>
          <strong className="text-foreground">Payments.</strong> PAN and CVV
          are never stored by Summex. Card-present readers and Finix handle
          card data. We store tokens, last four digits, amounts, which
          operator sold the line (entity split), and tips. Chargeback
          records follow the selling merchant(s).
        </p>
        <p>
          <strong className="text-foreground">Usage and logs.</strong> We
          keep operational logs needed to run the house: tickets, device
          online state, prints, cash events, and similar service records.
        </p>
        <p>
          <strong className="text-foreground">Optional AI.</strong> If you
          use in-product help or invoice reading, those features are not
          sent PAN or full card numbers. We minimize ticket personal data
          in those requests (for example, we do not need a guest phone to
          parse a vendor invoice).
        </p>
      </LegalSection>

      <LegalSection title="3. Why we use it">
        <ul className="list-disc space-y-1 pl-5">
          <li>Provide the POS, floor, kiosk, gift ledger, labor, and reports.</li>
          <li>
            Pay venues: route guest tenders on Quantum Payments / Finix and
            show settlement by line owner.
          </li>
          <li>Fraud, security, abuse, and device pairing integrity.</li>
          <li>Support the house when you write to us.</li>
          <li>Legal, tax-record, and network obligations.</li>
        </ul>
        <p>
          We do not sell personal information. We do not use guest lists for
          our own marketing.
        </p>
      </LegalSection>

      <LegalSection title="4. Text messages (SMS)">
        <p>
          Waitlist and reservation texts (join, table-ready, check-in code,
          opt-out) are sent because the guest gave the venue a number for
          that purpose. Reply STOP to opt out of those texts, or use the
          remove link we send. We use a messaging provider (Twilio or a
          successor) to deliver SMS. Email receipts, when you enable them,
          use an email vendor.
        </p>
      </LegalSection>

      <LegalSection title="5. Cookies">
        <p>
          The marketing site (summex.app) uses only what is needed to serve
          the pages — no advertising pixels from us. The console
          (app.summex.app) uses session cookies so an owner stays signed in.
          Staff stations rely on device pairing plus PIN, not marketing
          cookies.
        </p>
      </LegalSection>

      <LegalSection title="6. Sharing">
        <p>We share personal information only as needed to run the product:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Finix — card processing, merchant onboarding, disputes.</li>
          <li>Hosting — application hosting (Vercel).</li>
          <li>Database — our database provider, to store your operational data.</li>
          <li>Email and SMS vendors — transactional mail and waitlist texts.</li>
          <li>
            Payroll or accounting export — only if you connect or download
            that export. We do not send hours to a payroll company unless
            you do.
          </li>
        </ul>
        <p>
          We may disclose information if required by law, to protect guests
          and the house, or in a sale of the product line under this same
          policy. We do not sell personal information.
        </p>
      </LegalSection>

      <LegalSection title="7. Retention">
        <p>
          We keep account and operational records while the account is active
          and for a reasonable period after for legal recordkeeping,
          chargebacks, tax, and gift-ledger obligations. You may request
          deletion of an account; some payment and tax records cannot be
          erased on demand.
        </p>
      </LegalSection>

      <LegalSection title="8. Your rights">
        <p>
          You (and, where the law gives guests a direct right, a guest) may
          request access to or deletion of personal information we hold, and
          may ask us to correct it. California residents have CCPA/CPRA-style
          rights to know, delete, and opt out of sale — we do not sell
          personal information. Send requests to{" "}
          <a
            href="mailto:support@summex.app"
            className="text-champagne hover:underline"
          >
            support@summex.app
          </a>
          . We may need to verify the requester. The venue remains
          responsible for guest data it collected on its own outside Summex.
        </p>
      </LegalSection>

      <LegalSection title="9. Security">
        <p>
          We use encryption in transit, access control, and tenant isolation
          so one house does not see another’s tickets or staff. No method of
          transmission is perfectly secure. You must protect owner passwords
          and staff PINs. Do not put card numbers in email or chat.
        </p>
      </LegalSection>

      <LegalSection title="10. Children">
        <p>
          Summex is not directed at children. The product is for hospitality
          businesses and their adult staff and guests. We do not knowingly
          collect personal information from children under 13. If you believe
          we have, write to support@summex.app and we will delete it.
        </p>
      </LegalSection>

      <LegalSection title="11. Summex Station (staff tablet app)">
        <p>
          Summex Station is a staff tablet app for restaurants, food halls,
          and related venues. It is not a guest ordering app. Guests pay and
          scan table QR codes in the ordinary browser — never this app.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Venue pairing: a code or QR from the owner Devices screen stores
            the venue and station role (order, kitchen display, or host) on
            the tablet.
          </li>
          <li>
            Staff PIN: a 4-digit PIN identifies who is on the station. PINs
            are hashed and scoped to the venue. PIN is not clock-in and not
            the owner password.
          </li>
          <li>
            Device id: a local identifier so the house can see which tablet
            is online.
          </li>
          <li>No advertising SDKs. No analytics trackers in the station shell.</li>
          <li>
            Card numbers are not stored in the app. Guest cards run through
            Quantum Payments on the venue’s merchant account.
          </li>
          <li>
            This app does not use your Google account, contacts, or photos.
          </li>
        </ul>
        <p>
          Pairing and station role stay on the tablet so an app update does
          not send you back to the pair screen. Uninstalling removes local
          pairing on that tablet.
        </p>
      </LegalSection>

      <LegalSection title="12. Changes">
        <p>
          We will post a dated revision of this policy. Material changes will
          be noticed to the owner account. The effective date appears at the
          top of this page.
        </p>
      </LegalSection>

      <LegalSection title="13. Contact">
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
          Last revised {LEGAL_EFFECTIVE}. This policy describes our product
          practices. It is not legal advice to you.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
