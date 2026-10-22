import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  emailLocationFinixFormFn,
  generateLocationFinixFormFn,
  getLocationFinixOnboardingFn,
  markLocationReadyForLiveCardsFn,
  refreshLocationFinixFormFn,
} from "@/lib/payments/onboarding-api";
import {
  FINIX_MERCHANT_STATES,
  TRAINING_STAYS,
  type FinixMerchantState,
  type LocationFinixView,
} from "@/lib/payments/location-finix-form";

const STATE_BADGE: Record<FinixMerchantState, "warn" | "success" | "danger" | "info"> = {
  PROVISIONING: "info",
  APPROVED: "success",
  UPDATE_REQUESTED: "warn",
  REJECTED: "danger",
};

export function FinixLocationOnboardingCard({
  locationId,
  write,
  businessName,
  contactName,
  contactEmail,
  contactPhone,
  address,
  onSnapshot,
}: {
  locationId: string;
  write: boolean;
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  onSnapshot?: (row: LocationFinixView | null) => void;
}) {
  const [row, setRow] = useState<LocationFinixView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const onSnapshotRef = useRef(onSnapshot);
  onSnapshotRef.current = onSnapshot;

  const apply = useCallback((next: LocationFinixView) => {
    setRow(next);
    onSnapshotRef.current?.(next);
  }, []);

  const load = useCallback(() => {
    if (!locationId) return;
    void getLocationFinixOnboardingFn({ data: { locationId } })
      .then((next) => {
        setRow(next);
        onSnapshotRef.current?.(next);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load Finix onboarding"));
  }, [locationId]);

  useEffect(() => {
    load();
  }, [load]);

  const prefill = {
    businessName: businessName || row?.businessName || "",
    contactName: contactName || row?.contactName || "",
    email: contactEmail || row?.email || "",
    phone: contactPhone || row?.phone || "",
    line1: address || row?.line1 || "",
    city: row?.city || "",
    region: row?.region || "",
    postalCode: row?.postalCode || "",
  };

  const generate = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await generateLocationFinixFormFn({
        data: { locationId, ...prefill },
      });
      apply(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the Finix link");
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await refreshLocationFinixFormFn({ data: { locationId } });
      apply(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not refresh Finix status");
    } finally {
      setBusy(false);
    }
  };

  const email = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await emailLocationFinixFormFn({
        data: { locationId, to: prefill.email },
      });
      apply(next);
      setNotice(next.emailNotice === "email sent" ? "Email sent." : "Email not sent. Copy the link.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not email the link");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    const link = row?.linkUrl;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setNotice("Could not copy. Select the link and copy it.");
    }
  };

  const markReady = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await markLocationReadyForLiveCardsFn({ data: { locationId } });
      apply(next);
      setNotice("This location is ready for live cards.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "This location is not ready for live cards");
    } finally {
      setBusy(false);
    }
  };

  const state = row?.merchantState ?? null;
  const addressLine = [prefill.line1, prefill.city, prefill.region, prefill.postalCode].filter(Boolean).join(", ");

  return (
    <section
      className="mt-4 rounded-xl border border-border bg-bg p-3"
      data-checklist-focus="finix-onboarding"
      data-finix-location-onboarding=""
      tabIndex={-1}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">Start Finix merchant onboarding</p>
        {state ? (
          <Badge variant={STATE_BADGE[state]} data-finix-merchant-state={state}>
            {state}
          </Badge>
        ) : (
          <Badge variant="secondary" data-finix-merchant-state="waiting">
            {row?.linkUrl ? "Waiting on the form" : "Not started"}
          </Badge>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Underwriting takes time. Generate the Finix onboarding form after the location name,
        address, and contact are in. {TRAINING_STAYS}
      </p>
      <p className="mt-2 text-xs text-muted-foreground" data-finix-prefill="">
        Prefill: {prefill.businessName || "business name missing"}
        {addressLine ? ` · ${addressLine}` : " · address missing"}
        {prefill.email ? ` · ${prefill.email}` : " · email missing"}
        {prefill.contactName ? ` · ${prefill.contactName}` : ""}
        {prefill.phone ? ` · ${prefill.phone}` : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!write || busy}
          data-finix-generate-link=""
          onClick={() => void generate()}
        >
          {row?.linkUrl ? "Generate a new link" : "Generate link"}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy || !row?.formId} onClick={() => void refresh()}>
          Refresh status
        </Button>
      </div>
      {row?.linkUrl && (
        <div className="mt-3 space-y-2">
          <p className="break-all text-sm" data-finix-onboarding-link="">
            {row.linkUrl}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" data-finix-copy="" onClick={() => void copy()}>
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!write || busy || !prefill.email}
              data-finix-email-link=""
              onClick={() => void email()}
            >
              Email link to merchant
            </Button>
          </div>
        </div>
      )}
      <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
        <li data-finix-form-id="">Form {row?.formId || "—"}</li>
        <li data-finix-identity-id="">Identity {row?.identityId || "—"}</li>
        <li data-finix-merchant-id="">Merchant {row?.merchantId || "—"}</li>
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!write || busy || state !== "APPROVED"}
          data-ready-for-live-cards=""
          onClick={() => void markReady()}
        >
          Ready for live cards
        </Button>
        {row?.readyForLiveCards && <span className="text-xs text-muted-foreground">Marked ready</span>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Status: {FINIX_MERCHANT_STATES.join(" / ")}. Ready for live cards stays closed until APPROVED.
      </p>
      {notice && <p className="mt-2 text-sm">{notice}</p>}
      {error && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
