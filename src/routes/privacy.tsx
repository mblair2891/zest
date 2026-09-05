import { createFileRoute } from "@tanstack/react-router";
import { LandingFrame } from "@/components/marketing/LandingFrame";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy policy · Summex Station" },
      {
        name: "description",
        content:
          "How Summex Station uses venue pairing, staff PIN, and device data. No advertising SDKs. Card numbers are not stored in the app.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LandingFrame>
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <p className="mkt-kicker text-xs font-semibold tracking-[0.28em] text-champagne">
          LEGAL
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Privacy policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Summex Station · app.summex.pos · Effective 5 September 2026
        </p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-base font-semibold text-foreground">What this app is</h2>
            <p className="mt-2">
              Summex Station is a staff tablet app for restaurants, food halls, and related
              venues. It is not a guest ordering app. Guests pay and scan table QR codes in
              the ordinary browser — never this app.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">What we collect</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Venue pairing: a code or QR from the owner Devices screen stores the venue
                id and station role (order, kitchen display, or host) on this tablet.
              </li>
              <li>
                Staff PIN: a 4-digit PIN identifies who is on the station. PINs are hashed
                and scoped to the venue. PIN is not clock-in and not the owner password.
              </li>
              <li>
                Device id: a local identifier so the house can see which tablet is online.
              </li>
              <li>
                Service data: open checks, tickets, and cash activity for that venue, so
                the floor can keep running.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">What we do not collect</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>No advertising SDKs. No analytics trackers in the station shell.</li>
              <li>
                Card numbers are not stored in the app. Guest cards run through Quantum
                Payments on the venue’s merchant account.
              </li>
              <li>This app does not use your Google account, contacts, or photos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">Where data lives</h2>
            <p className="mt-2">
              Pairing and station role stay on the tablet so an app update does not send
              you back to the pair screen. Service data is stored for the venue that
              paired this device. The venue owner controls staff, Devices, and the house
              record.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">Who can see it</h2>
            <p className="mt-2">
              Floor staff see what their PIN allows. Owners and managers see Devices,
              reports, and settlement for their venue. Summex does not sell this data.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">Retention</h2>
            <p className="mt-2">
              Pairing stays until the owner retires the slot or the tablet is unpaired.
              Service records follow the venue’s retention. Uninstalling the app removes
              local pairing on that tablet.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">Contact</h2>
            <p className="mt-2">
              Questions: the venue owner, or{" "}
              <a href="mailto:privacy@summex.app" className="text-champagne hover:underline">
                privacy@summex.app
              </a>
              . Product site:{" "}
              <a href="https://summex.app" className="text-champagne hover:underline">
                summex.app
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </LandingFrame>
  );
}
