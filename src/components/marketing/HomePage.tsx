import {
  BookOpen,
  Building2,
  CookingPot,
  CreditCard,
  Landmark,
  ShieldCheck,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { SummexMark } from "@/components/brand/SummexMark";
import { PAYMENTS_BRAND, POWERED_BY, PRODUCT_DEFINITION, PRODUCT_NAME } from "@/lib/platform/brand";
import { LandingCta, LandingFrame } from "./LandingFrame";

const PAINS = [
  {
    title: "A POS that is only a cash register",
    body: "Floor, kitchen, and bar live in different tools. The guest feels the seams. Managers close the night in a spreadsheet.",
  },
  {
    title: "Bar and kitchen as two businesses at one table",
    body: "The guest is asked to pay twice. Tips, comps, and disputes cannot be split cleanly. The host has no ledger — only arguments.",
  },
  {
    title: "A second card brand at the check",
    body: "Stall operators bring their own processors. The house loses the guest relationship, the receipt, and any fair cut.",
  },
  {
    title: "Software that was built for retail checkout",
    body: "No sections, no KDS routing, no period settlement. A scanner and a SKU list will not run a dining room — or a hall.",
  },
];

const WHYS = [
  {
    icon: Building2,
    title: "One OS for every house you run",
    body: "A single dining room, a host venue with operators, or a group of locations — the same Summex. Organization and site are chosen after login, not as a maze of subdomains.",
  },
  {
    icon: UtensilsCrossed,
    title: "One check, even when operators differ",
    body: "Food from one operator, drinks from another, still a single guest bill. Lines stay tagged. Kitchen and bar still see only their tickets. The guest never runs two cards.",
  },
  {
    icon: CreditCard,
    title: `${PAYMENTS_BRAND} is the only guest card`,
    body: "The guest is charged once, under the host brand. There is no Stripe, Square, or processor picker in the product. Software billing is separate. Gift cards stay on the first-party Summex ledger.",
  },
  {
    icon: Landmark,
    title: "Settlement that matches the check",
    body: "Period close allocates merchandise, card fees, optional host cut, and cash due. When a dispute is filed — only then — a $35 fee splits by merchandise share on that check.",
  },
  {
    icon: CookingPot,
    title: "Floor, sections, kitchen, and bar",
    body: "Color-coded sections, manager grants, comps and voids with PIN rules. Tickets route by station and operator. Bump notifies the floor. Built for service, not a counter SKU list.",
  },
  {
    icon: BookOpen,
    title: "Live in weeks, not a months-long IT project",
    body: "Describe the operation. Summex snapshots a quote, you accept, contract is marked signed, and a guided wizard creates org, locations, operators, packages, and invites. The Operators Guide is in the product from day one.",
  },
  {
    icon: Users,
    title: "Kiosk, waitlist, and reservation check-in",
    body: "Guests order, join a wait, or check in with a last name and short code. Staff keep the host stand. The kiosk is for the guest — not a second login to the house.",
  },
];

const AUDIENCES = [
  {
    title: "Single-unit restaurants & bars",
    body: "Table or counter service, kitchen and bar routing, staff PINs, cash, gift, and a floor that knows its sections. Start on the included POS core; add labor, guests, and marketing when the house needs them.",
  },
  {
    title: "Multi-operator host venues",
    body: "A bar and a kitchen, or a hall of stalls, under one guest-facing brand. One Quantum Payments capture. Operators paid from their share on the period — not from a second card terminal at the table.",
  },
  {
    title: "Multi-unit & franchise-style operations",
    body: "One application, many sites. Packages per location, invites by role, a control plane for the portfolio. You do not stitch five vendors every time you open a room.",
  },
];

const MONEY = [
  {
    step: "01",
    title: "Guest pays the host",
    body: `One check, host brand on the receipt, captured through ${PAYMENTS_BRAND}. Cash and first-party gift sit beside the card — never a second processor.`,
  },
  {
    step: "02",
    title: "Lines keep their operator",
    body: "Kitchen, bar, and stalls are tagged on the item. Tickets still route apart. The guest does not see the split; the house does.",
  },
  {
    step: "03",
    title: "Operators are paid on the period",
    body: "Close the period. Summex mints a ledger: merchandise share, fees, host cut, cash due, and any $35 dispute fee. Payouts are addressed on that ledger — not claimed as live bank rails.",
  },
];

const PACKAGES = [
  {
    name: "Starter",
    price: "Included trial",
    note: "POS core, kitchen & bar KDS, menu, and cash. Enough to run a counter or a first dining room.",
  },
  {
    name: "Full service",
    price: "Quoted per location",
    note: "Host stand, labor, inventory, guests, and marketing — the paid packages a full room actually uses.",
  },
  {
    name: "Host / hall",
    price: "Quoted per location",
    note: "Multi-operator checks, settlement, vendor portal. For houses where more than one brand shares a guest.",
  },
];

const TRUST = [
  {
    icon: ShieldCheck,
    title: POWERED_BY,
    body: "Summex is powered by Quantum Reach. Guest cards run only through Quantum Payments. Access is role-based; the control plane is not mixed into the floor.",
  },
  {
    icon: BookOpen,
    title: "Operators Guide included",
    body: "Searchable, role-aware, in the product. Floor, settlement, payments, and onboarding — without a binder or a second login.",
  },
  {
    icon: CreditCard,
    title: "Honest about money movement",
    body: "We will not invent bank partners. Settlement is a product ledger you can run today. Live ACH is not claimed on this page.",
  },
];

function Kicker({ children }: { children: string }) {
  return (
    <p className="mkt-kicker font-display text-xs text-champagne uppercase">
      {children}
    </p>
  );
}

export function HomePage() {
  return (
    <LandingFrame>
      <main>
        <section className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24">
          <div className="mkt-fade flex flex-col items-start">
            <SummexMark className="h-11 w-11 text-ivory" />
            <Kicker>{PRODUCT_NAME}</Kicker>
            <h1 className="mt-5 max-w-4xl font-display text-4xl font-medium leading-[0.98] tracking-tight text-ivory text-balance sm:text-6xl lg:text-7xl">
              The hospitality OS for the house you run — and the ones after it.
            </h1>
            <p className="mt-5 font-display text-xl italic tracking-wide text-champagne sm:text-2xl">
              Powered by {POWERED_BY}
            </p>
            <p className="mt-7 max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
              {PRODUCT_DEFINITION} One product for a single restaurant or bar, a
              multi-operator host venue, or a multi-unit and franchise-style
              group.
            </p>
            <div className="mkt-fade mkt-d2 mt-10 flex flex-wrap items-center gap-3">
              <LandingCta to="/demo">Demo sites</LandingCta>
              <LandingCta to="/get-pricing" tone="ghost">
                Get pricing
              </LandingCta>
              <LandingCta to="/login" tone="ghost">
                Sign in
              </LandingCta>
              <Link
                to="/guide"
                className="inline-flex h-12 items-center px-2 text-xs font-semibold tracking-widest text-champagne uppercase transition-colors hover:text-ivory"
              >
                Operators Guide
              </Link>
            </div>
          </div>
        </section>

        <div className="mkt-rule" />

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
            <div>
              <Kicker>The problem</Kicker>
              <h2 className="mt-4 font-display text-3xl font-medium text-ivory text-balance sm:text-4xl">
                Most houses are running a stack. Guests can tell.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
                Summex is one system for service and money movement — so you stop
                paying a POS, a KDS, a hall splitter, and a second card brand to
                disagree with each other.
              </p>
            </div>
            <ul className="grid gap-px bg-border sm:grid-cols-2">
              {PAINS.map((p) => (
                <li key={p.title} className="bg-ink px-6 py-7 sm:px-7">
                  <h3 className="font-display text-lg font-medium text-ivory">
                    {p.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">
                    {p.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="mkt-rule" />

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="mb-14 max-w-2xl">
            <Kicker>Why Summex</Kicker>
            <h2 className="mt-4 font-display text-3xl font-medium text-ivory text-balance sm:text-4xl">
              Built for how a real house actually takes money.
            </h2>
          </div>
          <ul className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
            {WHYS.map((w) => (
              <li key={w.title} className="bg-ink px-6 py-8 sm:px-8 sm:py-10">
                <w.icon className="h-4 w-4 text-champagne" strokeWidth={1.25} />
                <h3 className="mt-5 font-display text-xl font-medium text-ivory">
                  {w.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {w.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <div className="mkt-rule" />

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <Kicker>Who it is for</Kicker>
          <h2 className="mt-4 max-w-2xl font-display text-3xl font-medium text-ivory text-balance sm:text-4xl">
            One dining room. A hall of operators. A group of houses.
          </h2>
          <ul className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            {AUDIENCES.map((a) => (
              <li key={a.title}>
                <h3 className="font-display text-xl font-medium text-ivory">
                  {a.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {a.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <div className="mkt-rule" />

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <Kicker>Multi-operator houses</Kicker>
          <h2 className="mt-4 max-w-2xl font-display text-3xl font-medium text-ivory text-balance sm:text-4xl">
            One guest check. Every operator paid.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
            When more than one brand feeds the same table, the guest still pays
            once through {PAYMENTS_BRAND} under the host. Operators are paid from
            the period ledger — not from a second terminal.
          </p>
          <ol className="mt-14 grid gap-px bg-border lg:grid-cols-3">
            {MONEY.map((m) => (
              <li key={m.step} className="bg-ink px-6 py-8 sm:px-8 sm:py-10">
                <p className="font-display text-sm tracking-widest text-champagne">
                  {m.step}
                </p>
                <h3 className="mt-4 font-display text-xl font-medium text-ivory">
                  {m.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {m.body}
                </p>
              </li>
            ))}
          </ol>
          <p className="mt-8 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            {PAYMENTS_BRAND} is guest-facing only. Software invoices are separate.
            Period payouts are a Summex ledger (export-ready). We do not claim a
            live bank partner on this page.
          </p>
        </section>

        <div className="mkt-rule" />

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <Kicker>Path to value</Kicker>
              <h2 className="mt-4 font-display text-3xl font-medium text-ivory text-balance sm:text-4xl">
                Start on core. Pay for the house you actually run.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground text-pretty">
                POS core and KDS ship on the starter trial. Full-service and host
                features live on paid packages — quoted from your operation, not a
                public rate card that pretends every room is the same.
              </p>
            </div>
            <LandingCta to="/get-pricing">Start intake</LandingCta>
          </div>
          <ul className="mt-14 grid gap-px bg-border md:grid-cols-3">
            {PACKAGES.map((p) => (
              <li key={p.name} className="bg-ink px-6 py-8 sm:px-8">
                <p className="text-xs tracking-widest text-champagne uppercase">
                  {p.name}
                </p>
                <p className="mt-3 font-display text-2xl font-medium text-ivory">
                  {p.price}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {p.note}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-8">
            <Link
              to="/pricing"
              className="text-xs font-semibold tracking-widest text-champagne uppercase hover:text-ivory"
            >
              See package outline
            </Link>
          </p>
        </section>

        <div className="mkt-rule" />

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <Kicker>Trust</Kicker>
          <h2 className="mt-4 max-w-2xl font-display text-3xl font-medium text-ivory text-balance sm:text-4xl">
            No invented customers. No invented banks.
          </h2>
          <ul className="mt-14 grid gap-10 md:grid-cols-3">
            {TRUST.map((t) => (
              <li key={t.title}>
                <t.icon className="h-4 w-4 text-champagne" strokeWidth={1.25} />
                <h3 className="mt-4 font-display text-xl font-medium text-ivory">
                  {t.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {t.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <div className="mkt-rule" />

        <section className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6 sm:py-32">
          <Kicker>Begin</Kicker>
          <h2 className="mx-auto mt-5 max-w-2xl font-display text-4xl font-medium text-ivory text-balance sm:text-5xl">
            Describe the operation. We will price the house you have.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground text-pretty">
            Intake takes minutes. You get a snapshot quote, then a contract step
            and a guided setup — org, locations, operators, packages. Not a
            six-month integration.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <LandingCta to="/get-pricing">Get pricing</LandingCta>
            <LandingCta to="/signup" tone="ghost">
              Create an account
            </LandingCta>
            <LandingCta to="/demo" tone="ghost">
              Demo sites
            </LandingCta>
          </div>
        </section>
      </main>
    </LandingFrame>
  );
}
