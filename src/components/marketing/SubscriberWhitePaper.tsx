import type { ReactNode } from "react";
import { LandingCta } from "@/components/marketing/LandingFrame";
import { PAYMENTS_BRAND, POWERED_BY, PRODUCT_NAME } from "@/lib/platform/brand";

/**
 * Public subscriber paper. Quote interview lives at `/get-pricing`, not here.
 */
export function SubscriberWhitePaper() {
  return (
    <article
      data-page="white-paper"
      className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16"
    >
      <p className="mkt-kicker font-display text-xs text-champagne uppercase">
        White paper · for owners and operators
      </p>
      <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-ivory sm:text-5xl">
        {PRODUCT_NAME}
      </h1>
      <p className="mt-3 font-display text-xl italic text-champagne">
        Hospitality operations, all in one system. Powered by {POWERED_BY}.
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        summex.app · Guest cards: {PAYMENTS_BRAND} only
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Revision · 12 Sep 2026 — Aligns with Operators Guide v2026.10.76. Gift
        lookup at summex.app/gift. Spent plastic can be reused.
      </p>
      <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
        For the owner considering Summex — a single shop, a full dining room, or a
        building that more than one brand shares. How the house runs for guests
        and staff. Not a software specification, a rate card, or a bank offering.
      </p>

      <Section n="1" title="What Summex is">
        <p>
          Summex is the hospitality operating system for a counter, a dining room,
          or a named building where more than one operator can appear on a{" "}
          <strong className="text-ivory">single guest check</strong>. It is powered
          by {POWERED_BY}. Guest-facing cards run exclusively through {PAYMENTS_BRAND}.
        </p>
        <p>
          The guest pays once. Food from one operator and drinks from another still
          sit on one bill. The receipt groups lines by vendor. Each selling brand
          is its own {PAYMENTS_BRAND} merchant; capture splits on that check.
          Kitchen and bar still see only their tickets.
        </p>
        <ul>
          <li>
            <strong className="text-ivory">One shop</strong> — a restaurant, bar,
            café, or QSR. One brand owns the menu, the floor, and the money.
          </li>
          <li>
            <strong className="text-ivory">Host + operators</strong> — a house brand
            owns the floor and may sell; tenants sell on the same check.
          </li>
          <li>
            <strong className="text-ivory">A shared building (peers)</strong> — a
            named place only. Two or more independent operators. No landlord-brand
            POS, host menu, or house gift product is required. The building is not
            a merchant. Untagged lines do not sell.
          </li>
        </ul>
        <p>
          Software billing (Summex packages) is{" "}
          <strong className="text-ivory">separate</strong> from guest card processing.
        </p>
      </Section>

      <Section n="2" title="Who it is for">
        <p>
          <strong className="text-ivory">Counter service.</strong> Order, send, pay.
          Kitchen or bar display. Cash and gift beside the card.
        </p>
        <p>
          <strong className="text-ivory">Full service.</strong> Sections, host stand,
          closeout, labor, guests. The floor knows its tables.
        </p>
        <p>
          <strong className="text-ivory">Shared building or hall.</strong> A distillery
          and a kitchen, or a hall of stalls, under one guest-facing name. One check.
          Each brand is paid from its share — not from a second terminal at the table.
        </p>
      </Section>

      <Section n="3" title="Guest experience">
        <ul>
          <li>
            <strong className="text-ivory">One check.</strong> Food and drink from
            different operators still tender once, under the house name, on{" "}
            {PAYMENTS_BRAND}.
          </li>
          <li>
            <strong className="text-ivory">One receipt, itemized by vendor.</strong>{" "}
            The guest still holds one document.
          </li>
          <li>
            <strong className="text-ivory">Printed prices stay clean.</strong> The
            card / printed amount is the menu (for example $15.00).
          </li>
          <li>
            <strong className="text-ivory">Cash discount, when you post one.</strong>{" "}
            Typically a <strong className="text-ivory">5% cash-discount program</strong>,
            then rounded up to a quarter. $12.00 printed becomes $11.50 cash.{" "}
            {PAYMENTS_BRAND} still captures the printed amount on card.
          </li>
          <li>
            <strong className="text-ivory">QR, as you set it.</strong> Table tents,
            reorder after staff open a check, pay and split. Guest UI is public —
            no staff PIN. After pay they stay on thank-you.
          </li>
          <li>
            <strong className="text-ivory">Gift balance, no login.</strong>{" "}
            summex.app/gift. Full printed number, or last four plus the card PIN.
            Current life only — load, redeem, void, date, venue, amount. No staff
            names.
          </li>
        </ul>
      </Section>

      <Section n="4" title="Floor and staff">
        <p>The tablet is a screen. PIN says who is working.</p>
        <div className="my-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs tracking-widest text-champagne uppercase">
                <th className="pb-2 pr-4">Station</th>
                <th className="pb-2">What it is</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-t border-border">
                <td className="py-2 pr-4 text-ivory">Order</td>
                <td>Handhelds and bar — menu, checks, pay, gift</td>
              </tr>
              <tr className="border-t border-border">
                <td className="py-2 pr-4 text-ivory">ODS</td>
                <td>Kitchen and bar display — tickets, Start and Bump. No pay</td>
              </tr>
              <tr className="border-t border-border">
                <td className="py-2 pr-4 text-ivory">Host</td>
                <td>Floor map, seat, table status, to-go at the stand</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          <strong className="text-ivory">PIN is not clock-in and not closeout.</strong>{" "}
          Owners use a back-office password. Floor staff use a 4-digit PIN. Clock
          in and out is Labor. Server closeout is Cash. During the shift, staff can
          move cash till to till when one drawer is short on small bills; expected
          cash on each till updates so the blind count still balances.
        </p>
        <p>
          Kiosk and waitlist sit beside the host stand. Staffing recs never clock
          anyone out.
        </p>
      </Section>

      <Section n="5" title="Multi-entity houses">
        <p>
          A named building can hold two independent operators — a bar and a kitchen
          is the usual picture — without inventing a landlord brand.
        </p>
        <ul>
          <li>Each operator owns their menu, tickets, recipes, staff, and schedule.</li>
          <li>
            The guest still pays <strong className="text-ivory">one check</strong>.
            Capture splits to each brand’s {PAYMENTS_BRAND} merchant by who sold
            the line.
          </li>
          <li>
            Gift is a house ledger (swipe, scan, or key) — not the card processor.
            Guests check the current balance at summex.app/gift. Spent plastic can
            be reused: the old ledger stays in audit; the same printed number gets
            a new card id at $0. The next load is a new issuance for the selling
            entity.
          </li>
          <li>
            Period close is the house book for cash, any host cut, and disputes.
            Live bank payout of leftovers is not claimed here.
          </li>
        </ul>
      </Section>

      <Section n="6" title="Money and hardware">
        <p>
          <strong className="text-ivory">Staff stations are Android tablets
          running the Summex Station app (sideload now; Play later).</strong>{" "}
          Bring your own printers, cash drawers, and stands. Summex is the
          software. Guest QR pay/order stays on the guest’s own phone browser.
          iPad and browser POS are not a supported house setup.
        </p>
        <p>
          <strong className="text-ivory">
            Live cards require Quantum / Finix-class readers supplied through Summex
          </strong>{" "}
          (drop-ship to the site). Customer-owned Square, Stripe, or bank terminals
          are not supported. Training can run on cash and sandbox cards.
        </p>
        <p>
          Processing story for the house: a{" "}
          <strong className="text-ivory">5% cash-discount program</strong> on posted
          prices — not a wholesale interchange table. This paper does not publish
          processor rate cards.
        </p>
      </Section>

      <Section n="7" title="Operations behind the floor">
        <ul>
          <li>
            <strong className="text-ivory">Recipes and costing</strong> — against what
            that entity sold. Upload invoices or receipts (PDF, photo, or spreadsheet).
            Recipe usage is compared to what that entity received. Gaps flag the
            entity manager — not an accusation. They record why (event, take-home,
            breakage, mis-ring, or a theft review). Venue admin only if they opted in.
          </li>
          <li>
            <strong className="text-ivory">Labor</strong> — hours and recs against what
            that entity is paid (owned lines on a shared floor).
          </li>
          <li>
            <strong className="text-ivory">Scheduling per entity.</strong> One operator’s
            week is not the other’s. Clock in is still the house tablet.
          </li>
          <li>
            <strong className="text-ivory">HR and payroll export.</strong> Hours to ADP,
            Intuit, or CSV. Summex does not process payroll.
          </li>
        </ul>
      </Section>

      <Section n="8" title="Devices">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Install Summex Station on an Android tablet (sideload now; Play later).</li>
          <li>The owner adds a device (name and role) and shows a one-time code or QR.</li>
          <li>The tablet pairs, then opens on the PIN pad.</li>
          <li>
            Publish changes pushes menu, floor, printers, and QR. Never mid-check.
          </li>
        </ol>
        <p className="mt-4">
          A broken kitchen display is a role change on that tablet — same pair,
          staff PIN in again. Do not reinstall.
        </p>
      </Section>

      <Section n="9" title="Plans">
        <p>
          Quoted from the live catalog at Get a price — not a frozen rate card.
          Defaults:
        </p>
        <div className="my-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs tracking-widest text-champagne uppercase">
                <th className="pb-2 pr-4">Package</th>
                <th className="pb-2">Monthly</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-t border-border">
                <td className="py-2 pr-4 text-ivory">Base (counter)</td>
                <td>$0 — POS and one kitchen or bar display</td>
              </tr>
              <tr className="border-t border-border">
                <td className="py-2 pr-4 text-ivory">Full service</td>
                <td>$149 / location — floor, host stand, sections, closeout</td>
              </tr>
              <tr className="border-t border-border">
                <td className="py-2 pr-4 text-ivory">Shared venue</td>
                <td>$299 / location + $49 / selling entity</td>
              </tr>
              <tr className="border-t border-border">
                <td className="py-2 pr-4 text-ivory">Ops pack</td>
                <td>$99 / location — recipes, costing, labor, HR export</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Extra order or ODS station beyond four included: $19 / month each. Guest
          kiosk software: $29 / month each. Setup defaults to $0. SMS: 500 texts /
          location / month included; extra at cost, or cap and stop.
        </p>
        <p>Those lines are listed here as the catalog — this page is not a quote form.</p>
      </Section>

      <Section n="10" title="How to start">
        <p>
          Open <strong className="text-ivory">Get a price</strong> on summex.app.
          Pick how the house is organized, service style, modules, and counts.
          The quote updates as you pick. There is no public demo restaurant and
          no login on the sales site.
        </p>
        <div className="mt-8">
          <LandingCta to="/get-pricing">Get a price</LandingCta>
        </div>
      </Section>

      <p className="mt-16 text-xs text-muted-foreground">
        © {POWERED_BY} · {PRODUCT_NAME} · summex.app · Michael Blair & Andy Baida
      </p>
    </article>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-14 border-t border-border pt-10">
      <p className="mkt-kicker text-xs text-champagne uppercase">
        {n.padStart(2, "0")}
      </p>
      <h2 className="mt-2 font-display text-2xl font-medium text-ivory">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
