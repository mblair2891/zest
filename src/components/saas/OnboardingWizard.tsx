import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VENUE_ENTITIES } from "@/lib/pos/entities";
import {
  createLocationFn,
  createOrganizationFn,
  inviteMemberFn,
} from "@/lib/saas/api";
import type { LocationMode } from "@/lib/pos/saas-types";
import { appHref } from "@/lib/platform/hosts";
import { saveTenantPosContext } from "@/lib/saas/pos-context";

export function OnboardingWizard({
  defaultName,
  onDone,
}: {
  defaultName?: string;
  onDone?: (ctx: { orgId: string; locationId?: string; venueType: LocationMode }) => void;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [orgName, setOrgName] = useState(defaultName ?? "");
  const [venueType, setVenueType] = useState<LocationMode>("restaurant");
  const [locName, setLocName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = (e: unknown) => {
    setError(e instanceof Error ? e.message : "Something went wrong");
    setBusy(false);
  };

  const makeOrg = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await createOrganizationFn({
        data: { name: orgName.trim(), venueType },
      });
      setOrgId(res.org.id);
      setStep(3);
    } catch (e) {
      fail(e);
      return;
    }
    setBusy(false);
  };

  const makeLocation = async () => {
    if (!orgId) return;
    setError(null);
    setBusy(true);
    try {
      const loc = await createLocationFn({
        data: {
          orgId,
          name: locName.trim() || orgName.trim(),
          venueType,
        },
      });
      setLocationId(loc.id);
      const { setActiveContextFn } = await import("@/lib/saas/api");
      await setActiveContextFn({
        data: { orgId, locationId: loc.id },
      });
      setStep(4); // ready: Open POS (+ optional invite)
    } catch (e) {
      fail(e);
      return;
    }
    setBusy(false);
  };

  const sendInvite = async () => {
    if (!orgId || !inviteEmail.trim()) {
      finish();
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const inv = await inviteMemberFn({
        data: { orgId, email: inviteEmail.trim(), role: "manager" },
      });
      setInviteUrl(inv.inviteUrl ?? null);
    } catch (e) {
      fail(e);
      return;
    }
    setBusy(false);
  };

  const goToPos = () => {
    if (orgId && locationId) {
      saveTenantPosContext({
        orgId,
        locationId,
        venueType,
        locationName: locName.trim() || orgName.trim(),
        orgName: orgName.trim(),
        ownerName: defaultName || "Owner",
      });
      window.location.href = appHref(
        `/venue/${venueType}?loc=${encodeURIComponent(locationId)}`,
      );
      return;
    }
    void navigate({ to: "/dashboard" });
  };

  const finish = () => {
    const ctx = {
      orgId: orgId ?? "",
      locationId: locationId ?? undefined,
      venueType,
    };
    onDone?.(ctx);
    if (!onDone) goToPos();
  };

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className={`h-1 flex-1 rounded-full ${n <= step ? "bg-primary" : "bg-surface-2"}`}
          />
        ))}
      </div>

      {step === 1 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Create your organization</h2>
          <p className="text-sm text-muted-foreground">
            This is the legal/operating entity. You can add more locations next.
          </p>
          <Input
            placeholder="e.g. Harbor Bistro Group"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
          />
          <Button
            className="w-full"
            disabled={orgName.trim().length < 2}
            onClick={() => setStep(2)}
          >
            Continue
          </Button>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">What kind of venue?</h2>
          <p className="text-sm text-muted-foreground">
            Sets the default POS modules for your first location. You can add other
            types later.
          </p>
          <div className="grid gap-2">
            {VENUE_ENTITIES.map((ent) => (
              <button
                key={ent.id}
                type="button"
                onClick={() => setVenueType(ent.id)}
                className={`rounded-2xl border px-4 py-3 text-left ${
                  venueType === ent.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-surface hover:border-primary/40"
                }`}
              >
                <span className="block text-sm font-semibold">{ent.name}</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {ent.tagline}
                </span>
              </button>
            ))}
          </div>
          <Button className="w-full" disabled={busy} onClick={() => void makeOrg()}>
            {busy ? "Creating…" : "Create organization"}
          </Button>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">First location</h2>
          <Input
            placeholder="e.g. Downtown"
            value={locName}
            onChange={(e) => setLocName(e.target.value)}
          />
          <Button className="w-full" disabled={busy} onClick={() => void makeLocation()}>
            {busy ? "Saving…" : "Create location"}
          </Button>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Location ready</h2>
          <p className="text-sm text-muted-foreground">
            Open the floor with a starter menu. Invite a teammate anytime — they
            only see this organization.
          </p>
          <Button className="w-full" onClick={goToPos}>
            Open POS
          </Button>
          <Input
            type="email"
            placeholder="Optional: manager@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <Button
            variant="outline"
            className="w-full"
            disabled={busy || !inviteEmail.trim()}
            onClick={() => void sendInvite()}
          >
            {busy ? "Sending…" : "Send invite"}
          </Button>
          {inviteUrl && (
            <p className="break-all rounded-xl border border-border bg-surface p-3 text-xs">
              {inviteUrl}
            </p>
          )}
        </section>
      )}

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
