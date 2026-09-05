import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SummexMark } from "@/components/brand/SummexMark";
import { pairStationFn } from "@/lib/access/api";
import { readOrCreateBrowserDeviceId } from "@/lib/pos/location-devices";
import {
  normalizeClaimCode,
  writeStationPair,
  type StationPairRecord,
} from "@/lib/pos/station-pair";
import { saveTenantPosContext } from "@/lib/saas/pos-context";
import { DEVICE_ROLE_BLURB, DEVICE_ROLE_LABEL } from "@/lib/pos/device-roles";

function readBrowserId(): string {
  try {
    return readOrCreateBrowserDeviceId("station");
  } catch {
    return "";
  }
}

export function StationPairScreen({
  initialCode = "",
  onPaired,
}: {
  initialCode?: string;
  onPaired: (row: StationPairRecord) => void;
}) {
  const [code, setCode] = useState(() => normalizeClaimCode(initialCode));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (raw: string) => {
    const claim = normalizeClaimCode(raw);
    if (claim.length < 4) {
      setError("Enter the code from Devices.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await pairStationFn({
        data: { claimCode: claim, browserDeviceId: readBrowserId() },
      });
      writeStationPair(res.pair);
      saveTenantPosContext({
        orgId: res.pair.orgId,
        locationId: res.pair.locationId,
        venueType: res.pair.venueType,
        locationName: res.pair.locationName,
        orgName: res.pair.orgName,
        ownerName: "Owner",
      });
      onPaired(res.pair);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not pair this tablet.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (initialCode && normalizeClaimCode(initialCode).length >= 4) {
      void submit(initialCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-bg px-4 pt-[var(--grok-banner-h,0px)] text-center">
      <SummexMark className="mb-4 h-12 w-12" />
      <p className="text-[11px] font-semibold tracking-[0.28em] text-muted-foreground">
        SUMMEX STATION
      </p>
      <h1 className="mt-3 text-xl font-semibold tracking-tight">Pair this tablet</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Ask the owner for the venue code or QR on Devices. After pair, this screen is PIN only.
        Guest QR stays in the browser.
      </p>
      <form
        className="mt-6 w-full max-w-sm space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(code);
        }}
      >
        <Input
          autoFocus
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Venue code"
          value={code}
          onChange={(e) => setCode(normalizeClaimCode(e.target.value))}
          className="h-12 text-center font-mono text-lg tracking-[0.3em]"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" className="h-12 w-full" disabled={busy || code.length < 4}>
          {busy ? "Pairing…" : "Pair"}
        </Button>
      </form>
      <ul className="mt-8 max-w-sm space-y-1 text-left text-xs text-muted-foreground">
        {(Object.keys(DEVICE_ROLE_LABEL) as Array<keyof typeof DEVICE_ROLE_LABEL>).map((id) => (
          <li key={id}>
            <span className="font-medium text-foreground">{DEVICE_ROLE_LABEL[id]}.</span>{" "}
            {DEVICE_ROLE_BLURB[id]}
          </li>
        ))}
      </ul>
    </div>
  );
}
