import { createFileRoute } from "@tanstack/react-router";
import { LandingFrame } from "@/components/marketing/LandingFrame";
import { SubscriberWhitePaper } from "@/components/marketing/SubscriberWhitePaper";

/**
 * Public white paper only. Quote interview is a separate route (`/get-pricing`).
 */
export const Route = createFileRoute("/whitepaper")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Summex White Paper · Quantum Reach" },
      {
        name: "description",
        content:
          "Summex, powered by Quantum Reach. One guest check, one or many operators, Quantum Payments. For owners considering the house.",
      },
    ],
  }),
  component: WhitePaperPage,
});

function WhitePaperPage() {
  return (
    <LandingFrame>
      <SubscriberWhitePaper />
    </LandingFrame>
  );
}
