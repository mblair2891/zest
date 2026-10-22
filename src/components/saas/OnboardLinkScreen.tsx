import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AuthShell } from "@/components/saas/AuthScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  acceptOnboardLinkFn,
  completeOnboardLinkFn,
  confirmEntityContactFn,
  emailOnboardFinixFn,
  peekOnboardLinkFn,
  saveOnboardAgreementFn,
  startOnboardFinixFn,
} from "@/lib/saas/onboard-link-api";
import type { OnboardLinkPeek } from "@/lib/saas/onboard-link";

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

export function OnboardLinkScreen({ token }: { token: string }) {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [peek, setPeek] = useState<OnboardLinkPeek | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [agreementName, setAgreementName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const load = () => {
    void peekOnboardLinkFn({ data: { token } })
      .then((next) => {
        setPeek(next);
        setAgreementName(next.agreementName || next.name || "");
        setAgreed(Boolean(next.agreementAt));
        setContactName(next.name || "");
        setContactPhone(next.phone || "");
        setError(null);
      })
      .catch((e) => setError(errMessage(e)));
  };

  useEffect(() => {
    load();
    // The token in the URL is the lookup key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const signIn = async (email: string, nextPassword: string) => {
    const { error: err } = await authClient.signIn.email({ email, password: nextPassword });
    if (err) throw new Error(err.message || "Could not sign in");
  };

  const onSetPassword = () => {
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    void acceptOnboardLinkFn({ data: { token, password } })
      .then(async (accepted) => {
        await signIn(accepted.email, password);
        setPassword("");
        setConfirm("");
        load();
      })
      .catch((e) => setError(errMessage(e)))
      .finally(() => setBusy(false));
  };

  const finish = () => {
    if (!user) {
      setError("Sign in with the password you set, then open the dashboard.");
      return;
    }
    setBusy(true);
    setError(null);
    void completeOnboardLinkFn({ data: { token } })
      .then((done) => {
        if (done.to === "setup" && done.setupToken) {
          void navigate({ to: "/setup/$token", params: { token: done.setupToken } });
          return;
        }
        void navigate({ to: "/dashboard" });
      })
      .catch((e) => setError(errMessage(e)))
      .finally(() => setBusy(false));
  };

  if (!peek && !error) {
    return (
      <AuthShell title="Onboarding" subtitle="Looking up your link…">
        <p className="text-center text-sm text-muted-foreground">Please wait</p>
      </AuthShell>
    );
  }

  if (!peek || peek.expired) {
    return (
      <AuthShell title="Link unavailable" subtitle={error ?? "This onboarding link is invalid or expired."}>
        <Button className="w-full" onClick={() => void navigate({ to: "/login" })}>
          Sign in
        </Button>
      </AuthShell>
    );
  }

  if (!peek.passwordSet) {
    return (
      <AuthShell
        title={peek.kind === "entity" ? `Join ${peek.entityName || peek.venueName}` : `Set up ${peek.venueName}`}
        subtitle="Set a password on this link. It expires in 14 days."
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Username: {peek.email}</p>
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button className="w-full" disabled={busy || password.length < 8} onClick={onSetPassword}>
            {busy ? "Saving…" : "Set password and continue"}
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {peek.label}
          {peek.kind === "venue" && peek.hostMerchant ? ` · Finix ${peek.finixLabel}` : ""}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">
          {peek.kind === "entity" ? peek.entityName || "Entity onboarding" : peek.venueName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {peek.kind === "entity"
            ? `${peek.seatLabel} at ${peek.venueName}. This page is only for that selling entity.`
            : "Venue onboarding. You will not see CRM or other tenants."}
        </p>
      </header>

      {error && <p className="text-sm text-danger">{error}</p>}
      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

      {!isPending && !user && (
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">Sign in to continue</h2>
          <p className="text-sm text-muted-foreground">Username: {peek.email}</p>
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            disabled={busy || password.length < 8}
            onClick={() => {
              setBusy(true);
              setError(null);
              void signIn(peek.email, password)
                .then(() => setPassword(""))
                .catch((e) => setError(errMessage(e)))
                .finally(() => setBusy(false));
            }}
          >
            Sign in
          </Button>
        </section>
      )}

      {peek.kind === "venue" && peek.hostMerchant && (
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">Summex merchant agreement</h2>
          <p className="text-sm text-muted-foreground">
            This venue is the host merchant. Quantum Payments settles guest cards for this house.
            Live cards stay off until Finix shows APPROVED. Training and sandbox cards stay available until then.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            I am authorized to accept the Summex merchant agreement for this venue.
          </label>
          <Input
            placeholder="Your name"
            value={agreementName}
            onChange={(e) => setAgreementName(e.target.value)}
          />
          <Button
            disabled={busy || !agreed || agreementName.trim().length < 2}
            onClick={() => {
              setBusy(true);
              setError(null);
              void saveOnboardAgreementFn({ data: { token, name: agreementName } })
                .then(setPeek)
                .catch((e) => setError(errMessage(e)))
                .finally(() => setBusy(false));
            }}
          >
            {peek.agreementAt ? "Agreement saved" : "Accept agreement"}
          </Button>
        </section>
      )}

      {peek.kind === "venue" && peek.hostMerchant && (
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">Start Finix merchant onboarding</h2>
          <p className="text-sm text-muted-foreground">
            Status: {peek.finixLabel}. Ready for live cards stays closed until APPROVED.
          </p>
          {!peek.hasLocation && (
            <p className="text-sm">
              Save the building in venue setup. Then return to this link and start Finix.
            </p>
          )}
          {peek.finixLinkUrl && (
            <p className="break-all text-sm">
              Finix form: {peek.finixLinkUrl}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || !peek.hasLocation}
              onClick={() => {
                setBusy(true);
                setError(null);
                void startOnboardFinixFn({ data: { token } })
                  .then(setPeek)
                  .catch((e) => setError(errMessage(e)))
                  .finally(() => setBusy(false));
              }}
            >
              {peek.finixStarted ? "Refresh Finix link" : "Start Finix"}
            </Button>
            {peek.finixLinkUrl && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void emailOnboardFinixFn({ data: { token } })
                    .then((res) => {
                      setPeek(res.peek);
                      setNotice(res.notice);
                    })
                    .catch((e) => setError(errMessage(e)))
                    .finally(() => setBusy(false));
                }}
              >
                Email Finix link
              </Button>
            )}
            {peek.setupToken && !peek.hasLocation && (
              <Button
                variant="outline"
                onClick={() =>
                  void navigate({ to: "/setup/$token", params: { token: peek.setupToken! } })
                }
              >
                Continue venue setup
              </Button>
            )}
          </div>
        </section>
      )}

      {peek.kind === "venue" && !peek.hostMerchant && (
        <section className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
          This is a peer venue. There is no host merchant, so this link skips host Finix and the
          Summex merchant agreement. Each selling entity finishes its own onboarding.
          {peek.setupToken && (
            <Button
              className="mt-3"
              variant="outline"
              onClick={() =>
                void navigate({ to: "/setup/$token", params: { token: peek.setupToken! } })
              }
            >
              Continue venue setup
            </Button>
          )}
        </section>
      )}

      {peek.kind === "entity" && (
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">This entity only</h2>
          <p className="text-sm text-muted-foreground">
            Role: {peek.seatLabel}. Host Finix and venue-wide settings are not on this page.
            The venue chose this scope.
          </p>
          <Input
            placeholder="Your name"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
          <Input
            placeholder="Phone"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void confirmEntityContactFn({
                data: { token, name: contactName, phone: contactPhone },
              })
                .then(setPeek)
                .catch((e) => setError(errMessage(e)))
                .finally(() => setBusy(false));
            }}
          >
            Save contact
          </Button>
        </section>
      )}

      {peek.missing.length > 0 && (
        <p className="text-sm text-muted-foreground">Still needed: {peek.missing.join(", ")}.</p>
      )}

      <Button className="w-full" disabled={busy || !peek.canComplete} onClick={finish}>
        {peek.kind === "entity" ? "Open entity dashboard" : "Finish and open dashboard"}
      </Button>
      {peek.completed && (
        <Button className="w-full" variant="outline" onClick={() => void navigate({ to: "/dashboard" })}>
          Go to dashboard
        </Button>
      )}
    </main>
  );
}
