import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/whitepaper")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Summex White Paper · Quantum Reach" },
      {
        name: "description",
        content:
          "Summex, powered by Quantum Reach. Per-entity Quantum Payments merchants, one guest check, gift ledger, device roles, cash, and settlement.",
      },
    ],
  }),
  component: WhitePaperPage,
});

function WhitePaperPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg pt-[var(--grok-banner-h,0px)]">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2 text-xs">
        <Link to="/" className="font-semibold tracking-widest">
          SUMMEX
        </Link>
        <span className="text-muted-foreground">White paper</span>
        <Link to="/guide" className="ml-auto text-muted-foreground hover:text-foreground">
          Operators Guide
        </Link>
      </div>
      <iframe
        title="Summex White Paper"
        src="/whitepaper.html"
        className="min-h-0 w-full flex-1 border-0"
      />
    </div>
  );
}
