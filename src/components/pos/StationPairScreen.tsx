import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SummexMark } from "@/components/brand/SummexMark";
import { pairStationFn } from "@/lib/access/api";
import { readOrCreateBrowserDeviceId } from "@/lib/pos/location-devices";
import {
  normalizeClaimCode,
  parsePairScan,
  writeStationPair,
  type StationPairRecord,
} from "@/lib/pos/station-pair";
import { saveTenantPosContext } from "@/lib/saas/pos-context";
import { applyStationPublish, parseStationPublish } from "@/lib/pos/station-publish";
import { persistLocationSnapshot } from "@/lib/offline/location-snapshot";
import { DEVICE_ROLE_BLURB, DEVICE_ROLE_LABEL } from "@/lib/pos/device-roles";
import { requestKioskLock } from "@/lib/native-kiosk";

function readBrowserId(): string {
  try {
    return readOrCreateBrowserDeviceId("station");
  } catch {
    return "";
  }
}

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
};

function getBarcodeDetector(): BarcodeDetectorLike | null {
  const Ctor = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike })
    .BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

export function StationPairScreen({
  initialCode = "",
  onPaired,
}: {
  initialCode?: string;
  onPaired: (row: StationPairRecord) => void;
}) {
  const [mode, setMode] = useState<"choose" | "code" | "scan">(
    initialCode ? "code" : "choose",
  );
  const [code, setCode] = useState(() => normalizeClaimCode(initialCode));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (raw: string) => {
    const parsed = parsePairScan(raw) ?? { token: normalizeClaimCode(raw) };
    const claim = parsed.token;
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
      try {
        const pub = parseStationPublish(res.publish);
        if (pub) applyStationPublish(pub);
        persistLocationSnapshot();
      } catch {
        /* snapshot is best-effort; PosApp hydrates next */
      }
      requestKioskLock();
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
    <div
      className="flex min-h-[100dvh] flex-col items-center justify-center bg-bg px-4 pt-[var(--grok-banner-h,0px)] text-center"
      data-demo="station-pair"
    >
      <SummexMark className="mb-4 h-12 w-12" />
      <p className="text-[11px] font-semibold tracking-[0.28em] text-muted-foreground">
        SUMMEX STATION
      </p>
      <h1 className="mt-3 text-xl font-semibold tracking-tight">Pair this tablet</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Scan the QR or enter the one-time code from Devices. After pair, this screen is PIN
        only. Guest QR stays in the phone browser.
      </p>

      {mode === "choose" && (
        <div className="mt-6 flex w-full max-w-sm flex-col gap-3">
          <Button
            type="button"
            className="h-12 w-full"
            onClick={() => {
              setError(null);
              setMode("scan");
            }}
          >
            Scan QR
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full"
            onClick={() => {
              setError(null);
              setMode("code");
            }}
          >
            Enter code
          </Button>
        </div>
      )}

      {mode === "code" && (
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
          <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("choose")}>
            Back
          </Button>
        </form>
      )}

      {mode === "scan" && (
        <QrScanPanel
          busy={busy}
          error={error}
          onRaw={(raw) => void submit(raw)}
          onBack={() => {
            setError(null);
            setMode("choose");
          }}
        />
      )}

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

function QrScanPanel({
  busy,
  error,
  onRaw,
  onBack,
}: {
  busy: boolean;
  error: string | null;
  onRaw: (raw: string) => void;
  onBack: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onRawRef = useRef(onRaw);
  onRawRef.current = onRaw;
  const [camError, setCamError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;
    const video = videoRef.current;
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        const det = getBarcodeDetector();
        if (!det) {
          setCamError("This tablet cannot scan QR. Enter the code instead.");
          return;
        }
        const tick = async () => {
          if (cancelled || !video) return;
          try {
            const codes = await det.detect(video);
            const raw = codes[0]?.rawValue;
            if (raw) {
              onRawRef.current(raw);
              return;
            }
          } catch {
            /* keep scanning */
          }
          raf = requestAnimationFrame(() => void tick());
        };
        raf = requestAnimationFrame(() => void tick());
      } catch {
        if (!cancelled) setCamError("Camera permission is needed to scan. Enter the code instead.");
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="mt-6 w-full max-w-sm space-y-3">
      <video
        ref={videoRef}
        className="aspect-square w-full rounded-2xl border border-border bg-black object-cover"
        playsInline
        muted
        autoPlay
      />
      {(error || camError) && (
        <p className="text-sm text-danger">{error || camError}</p>
      )}
      {busy && <p className="text-sm text-muted-foreground">Pairing…</p>}
      <Button type="button" variant="outline" className="h-12 w-full" onClick={onBack}>
        Enter code instead
      </Button>
    </div>
  );
}
