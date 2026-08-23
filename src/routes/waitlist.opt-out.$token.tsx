import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { optOutWaitlistFn } from "@/lib/front/api";
import { useNotifyStore } from "@/lib/pos/notify-store";

export const Route = createFileRoute("/waitlist/opt-out/$token")({
  ssr: false,
  component: OptOutPage,
});

function OptOutPage() {
  const { token } = Route.useParams();
  const [msg, setMsg] = useState("Removing you from the waitlist…");

  useEffect(() => {
    void optOutWaitlistFn({ data: { token } })
      .then((r) => {
        useNotifyStore.getState().pushNotice({
          kind: "waitlist_update",
          title: "Waitlist",
          body: `${r.name} removed themselves from the waitlist`,
        });
        setMsg(`${r.name} is off the waitlist. The host stand has been notified.`);
      })
      .catch((e) =>
        setMsg(e instanceof Error ? e.message : "This link is no longer valid"),
      );
  }, [token]);

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-bg px-4 pt-[var(--grok-banner-h,0px)] text-center">
      <div className="max-w-md">
        <h1 className="font-display text-3xl font-medium">Waitlist</h1>
        <p className="mt-3 text-sm text-muted-foreground">{msg}</p>
        <Link to="/" className="mt-6 inline-block text-sm underline">
          Home
        </Link>
      </div>
    </main>
  );
}
