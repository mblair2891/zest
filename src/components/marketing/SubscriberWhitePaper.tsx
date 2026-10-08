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
        Revision · 7 Oct 2026 — The canvas is the workspace and is larger than the room. Room width and depth are in feet. Apply draws four walls inside the canvas, centered, with a margin. Pieces already there stay, and a table can touch a wall. A door or window cuts the wall it lands on. Drag the cut along the wall. Length sets the opening. Snip splits a wall so a segment can be deleted or dragged into an L or a notch, and tables stay. Publish floor saves the walls, openings, and snips. Refresh shows the same outline. Fit room frames the walls. The floor editor pieces bar has Couch next to the booths. Dropping it places a low sofa with no seat dots. The side panel seat count starts at 3. Resize from the ends. Rotate 90 turns it. The couch stays in the room it is placed in. Publish floor saves the sofa, the seat count, and the angle. The live floor shows that same shape and the table number, still with no dots. On an L bar the stool counts are Long leg and Short leg. Long is the longer run. The bar does not print those words. Generate stools walks from the short open end through the corner to the long open end. Reverse numbering starts at the long open end. A corner seat sits between the legs. Publish floor saves the B numbers. Clear slate is on the floor view bar. It asks before it removes every table, booth, stool, wall, and bar on the floor being edited. Rooms stay. An entity owner clears only the rooms they own. The location contact clears the whole floor. Publish floor saves the empty canvas. A refresh does not restore the pieces. The floor editor opens with two bars. Pieces stay on one line. Drag a grip to undock a bar, move it, and drop it on the top, left, or right. The layout stays on this browser. Reset layout puts both bars back on top, pieces first. Trash on a bar still deletes the stools bound to it. The floor toolbar is one row, and the title stays visible. Publish floor sits on that row. Trash on a bar deletes the stools bound to it, and Publish keeps them gone. Signing the contract creates the venue owner’s back-office login. An entity login saves its own menu, and a refresh shows the edit. Remove deletes that shift, and Update placed removes a day that left the pattern. A paired tablet with a valid PIN shares the open check, the bump, an 86, and the clock punch at that location. A live Finix card uses that entity’s merchant and does not call Stripe. Set shifts saves a named pattern with days, a start, an end, and a role, and no one on it. Assign staff later for a date range or a number of weeks. Those shifts land as drafts. Publish week still puts them on the clock. Editing the pattern leaves placed shifts as they are until you choose Update placed. Someone from another entity still needs a grant. On a peer venue with no host, an entity owner publishes the rooms that entity owns, including the tables in those rooms, the seat counts, and the shapes. Another entity’s rooms stay as they were. A House room stays locked unless this login is the location contact. The location contact still publishes the whole floor. Tables on the floor editor and the live floor are the shape only: round, square, or booth. The seat count is a number on the table popup and in the side panel. Changing seats does not add marks. Barstools stay their own pieces. On an L bar the stool counts are Long leg and Short leg, and the numbers walk from the short open end through the corner to the long open end. The bar does not print those words. Reverse numbering starts at the long open end. A corner seat sits between the legs. A straight bar still starts at one end. Generate stools applies that order. Clicking a table or fixture this login cannot edit names that section’s owner, such as Table 1 is on Diamond House BBQ’s section. A House room says House (shared). That piece cannot be moved, resized, or deleted. The location contact can. Each floor room has an owner: a selling entity at this venue, or House. House is shared. Publish waits until every room is set. An entity edits only rooms it owns, plus active seating loans. A loan does not change the owner. There is no public account signup. A platform admin or a location or entity admin creates the account. The invite email still opens for that person. An entity owner sees that entity’s name, then the venue. Today’s home is this entity’s sales, open checks, labor, top items, and 86 count. The menu is grouped by category, and 86 is on the item. The floor editor changes this entity’s sections and active seating loans. System mail is from Summex noreply. Replies go to support@summex.app. If mail is not configured, the screen says email not sent. Aligns with Operators Guide v2026.10.204.
        The house toggles which tenders it accepts. Station UI is device role ∩
        staff PIN. After PIN the tablet shows a short role menu. Pair with a
        typed Devices code; QR is optional. Peer venues have no host merchant;
        the host stand is still a device role. Gift cards sell on a paired
        station — not the public website. QR is on-premise. MCC 5813 is
        on-premise retail only.
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
            a merchant. The billing contact is not a merchant. Untagged lines do
            not sell.
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
            Lines group under the brand that sold them, with a total per vendor,
            then a grand total. The guest still holds one document.
          </li>
          <li>
            <strong className="text-ivory">Cash is the entered price.</strong> The
            operator types the cash (till) amount.
          </li>
          <li>
            <strong className="text-ivory">Cash discount, when you post one.</strong>{" "}
            Typically a <strong className="text-ivory">5% cash-discount program</strong>.
            Card is cash marked up, then rounded up. $18.00 cash at 5% with a $1.00
            increment becomes $19.00 card. Cash pay charges cash; card pay charges card.
          </li>
          <li>
            <strong className="text-ivory">QR, as you set it.</strong> On-premise
            only — table tent or check QR. The guest is at the location. No
            e-commerce cart, no alcohol delivery, no shipping. Reorder after staff
            open a check, pay and split. Guest UI is public — no staff PIN. After
            pay they stay on thank-you.
          </li>
          <li>
            <strong className="text-ivory">Gift cards, first-party ledger.</strong>{" "}
            Sell and redeem on a paired station. Not sold on the website. Not
            shipped. Guests look up balance at summex.app/gift. Default max load
            / balance / sell per transaction is $500.
          </li>
        </ul>
      </Section>

      <Section n="4" title="Floor and staff">
        <p>
          The tablet is a screen. Station UI is the intersection of{" "}
          <strong className="text-ivory">device role</strong> (what the hardware
          may do) and <strong className="text-ivory">staff PIN</strong> (which of
          those actions this person may use). Never the same home for every PIN.
        </p>
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
                <td>After PIN on full service: Floor, Checks, Menu, Pay. The map is status color and the table number — no chairs. Counter is New ticket. Drive-through is the lane. Close out is under Checks. The floor shows clocked in HH:MM.</td>
              </tr>
              <tr className="border-t border-border">
                <td className="py-2 pr-4 text-ivory">ODS</td>
                <td>Kitchen and bar display — tickets, Start and Bump, plus Close out (End shift). No POS hamburger, no new order, no pay</td>
              </tr>
              <tr className="border-t border-border">
                <td className="py-2 pr-4 text-ivory">Host</td>
                <td>After PIN: Floor, Checks, Menu, Pay. Waitlist, to-go, and Close out are under Checks. Peer venues still have this role — no host merchant required.</td>
              </tr>
              <tr className="border-t border-border">
                <td className="py-2 pr-4 text-ivory">Kiosk</td>
                <td>Guest waitlist / QR / pay. Skips the staff PIN pad. Manager service PIN may reload or exit.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          <strong className="text-ivory">PIN is not clock-in and not closeout.</strong>{" "}
          Password login is back office — never the PIN home. Floor staff use a
          4-digit PIN on a paired station. Location owner and manager see those
          PINs on Users and can reset them; kitchen and server PINs cannot. A kitchen PIN on an order tablet is
          Close out and Done, not server UI. Enter opens the station. Clock in only punches.
          Clock out is Close out. During the shift, staff can move cash till to
          till when one drawer is short on small bills; expected cash on each till
          updates so the blind count still balances.
        </p>
        <p>
          Staffing recs never clock anyone out.
        </p>
      </Section>

      <Section n="5" title="Multi-entity houses">
        <p>
          A named building can hold two independent operators — a bar and a kitchen
          is the usual picture — without inventing a landlord brand.
        </p>
        <ul>
          <li>
            <strong className="text-ivory">Shared building:</strong> the billing
            owner signs in at app.summex.app/login (never the PIN pad), finishes
            a nine-step building wizard, and invites each operator. No Finix form
            and no menu on the building.
          </li>
          <li>Each operator owns their menu, tickets, recipes, staff, Finix merchant, and schedule. An invite cannot edit a sibling.</li>
          <li>
            The guest still pays <strong className="text-ivory">one check</strong>.
            Capture splits to each brand’s {PAYMENTS_BRAND} merchant by who sold
            the line.
          </li>
          <li>
            Gift is a house ledger (swipe, scan, or key) — not the card processor.
            Sell on a paired station; the issuer holds cash until redeem.
            Guests check the current balance at summex.app/gift. Cards are not sold
            online. Spent plastic can be reused: the old ledger stays in audit; the
            same printed number gets a new card id at $0. The next load is a new
            issuance for the selling entity.
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
            <strong className="text-ivory">Delivery.</strong> DoorDash and Uber Eats
            open a check as Marketplace payable. No second card. An unmapped line is
            an open item with a manager flag. The kitchen ticket follows the to-go route.
          </li>
          <li>
            <strong className="text-ivory">Owner ops.</strong> The selling entity’s
            home shows today’s sales, cash and card, comps, prime cost, labor, and
            food and beverage cost. A peer sees only its own numbers. A price test
            does not change the menu price.
          </li>
          <li>
            <strong className="text-ivory">Operations finance.</strong> Each selling
            entity keeps a restaurant chart of accounts, payables, inventory, actual
            versus theoretical, and a controllable P&amp;L. A location can view the
            rollup and cannot edit a peer’s books. Training journals stay in a sandbox
            until go-live. Summex does not connect another POS.
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
          <li>The owner adds a device (name and role) and shows a one-time code (QR optional).</li>
          <li>The tablet pairs, then opens on the PIN pad — except a kiosk, which is guest UI with no staff PIN.</li>
          <li>
            Publish changes pushes menu, floor, printers, and QR. Never mid-check.
          </li>
        </ol>
        <p className="mt-4">
          The paired role is the envelope. Staff PIN is which of those actions this
          person may use. A kitchen PIN on an order tablet stays on the clock
          sheet. A broken kitchen display is a role change on that tablet — same
          pair, staff PIN in again. Do not reinstall.
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
        Summex © Quantum Reach. summex.app
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
