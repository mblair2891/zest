import { useState, type FormEvent } from "react";
import { CreditCard } from "lucide-react";
import { publicLookupGiftFn } from "@/lib/gift/api";
import { guestStatusLabel, type GuestGiftLookupOk } from "@/lib/gift/guest-view";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { SummexMark, SummexWordmark } from "@/components/brand/SummexMark";

const KIND_LABEL: Record<GuestGiftLookupOk["activity"][number]["kind"], string> = {
  load: "Load",
  redeem: "Redeem",
  void: "Void",
};

export function GuestGiftPage() {
  const [number, setNumber] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<GuestGiftLookupOk | null>(null);

  async function lookup(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setCard(null);
    try {
      const res = await publicLookupGiftFn({
        data: { number, pin },
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCard(res);
    } catch {
      setError("Lookup failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mkt mkt-ambient relative min-h-[100dvh] overflow-x-hidden bg-ink pt-[var(--grok-banner-h,0px)] text-ivory">
      <div className="mkt-sheen" aria-hidden />
      <header className="relative z-20 border-b border-border">
        <div className="mx-auto flex h-16 max-w-lg items-center gap-2.5 px-4">
          <a href="/" className="flex items-center gap-2.5">
            <SummexMark className="h-7 w-7 text-ivory" />
            <SummexWordmark className="text-xs text-ivory" />
          </a>
        </div>
      </header>
      <main className="relative z-10 mx-auto w-full max-w-lg px-4 py-12 sm:py-16">
        <p className="mkt-kicker text-xs font-semibold text-champagne">
          GIFT CARD
        </p>
        <h1 className="mt-3 font-display text-3xl font-medium tracking-tight text-ivory sm:text-4xl">
          Check your balance
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Enter the full number on the card, or the last four digits plus the PIN
          printed on the back. This is the current life of that plastic — not a
          previous spent card.
        </p>
        <form onSubmit={(e) => void lookup(e)} className="mt-8 space-y-4">
          <label className="block text-xs tracking-widest text-champagne uppercase">
            Card number
            <input
              className="mt-2 flex h-12 w-full rounded-md border border-border bg-ink-2 px-3 font-mono text-base text-ivory outline-none ring-champagne/40 placeholder:text-muted-foreground focus:ring-2"
              inputMode="numeric"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="Full number or last four"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          </label>
          <label className="block text-xs tracking-widest text-champagne uppercase">
            Card PIN
            <span className="ml-2 font-sans font-normal tracking-normal text-muted-foreground normal-case">
              needed if you only have the last four
            </span>
            <input
              className="mt-2 flex h-12 w-full rounded-md border border-border bg-ink-2 px-3 font-mono text-base tracking-widest text-ivory outline-none ring-champagne/40 placeholder:text-muted-foreground focus:ring-2"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <button
            type="submit"
            disabled={busy || !number.trim()}
            className="inline-flex h-12 w-full items-center justify-center rounded-sm bg-champagne px-4 text-xs font-semibold tracking-widest text-ink uppercase disabled:opacity-50"
          >
            {busy ? "Looking up…" : "Look up"}
          </button>
        </form>
        {error && (
          <p className="mt-6 rounded-md border border-border bg-ink-2 px-4 py-3 text-sm text-ivory">
            {error}
          </p>
        )}
        {card && (
          <section className="mt-10 rounded-xl border border-border bg-ink-2 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm text-champagne">••••{card.last4}</p>
                <p className="mt-2 font-display text-4xl font-medium tabular text-ivory">
                  {formatCurrency(card.balanceCents)}
                </p>
                <p className="mt-1 text-xs tracking-widest text-muted-foreground uppercase">
                  {guestStatusLabel(card.status, card.onHold)}
                </p>
              </div>
              <CreditCard className="h-6 w-6 text-champagne" aria-hidden />
            </div>
            {card.onHold && (
              <p className="mt-4 text-sm text-muted-foreground">
                This card is on hold. Ask the house.
              </p>
            )}
            <h2 className="mt-6 text-xs tracking-widest text-champagne uppercase">
              Activity
            </h2>
            {card.activity.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {card.activity.map((row, i) => (
                  <li key={`${row.at}-${i}`} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                    <div>
                      <p className="text-ivory">{KIND_LABEL[row.kind]}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(row.at)}
                        {row.venueName ? ` · ${row.venueName}` : ""}
                      </p>
                    </div>
                    <span className="tabular text-ivory">
                      {row.amountCents > 0 ? "+" : ""}
                      {formatCurrency(row.amountCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
      <footer className="relative z-10 mx-auto max-w-lg px-4 pb-10 text-xs text-muted-foreground">
        summex.app · Gift balance is the current card only
      </footer>
    </div>
  );
}
