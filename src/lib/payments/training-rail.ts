/**
 * Training can send a card. The location stays in training until the owner marks it live.
 * Sandbox keys use the Finix sandbox host. Live keys do not capture real money in training.
 */

export function realFinixMerchantId(id: string | null | undefined): boolean {
  const s = String(id ?? "").trim();
  return s.length > 0 && !s.toLowerCase().includes("sandbox");
}

/** Payments shows Live when a selling entity has a merchant id and Finix keys are present. */
export function paymentsTabIsLive(opts: {
  merchantIds: Array<string | null | undefined>;
  sandboxKeys: boolean;
  liveKeys: boolean;
}): boolean {
  if (!opts.sandboxKeys && !opts.liveKeys) return false;
  return opts.merchantIds.some((id) => realFinixMerchantId(id));
}

export function paymentsRailLabel(opts: {
  railLive?: boolean;
  lifecycleForcesSandbox?: boolean;
  mode?: "sandbox" | "live" | null;
  liveReady?: boolean;
} | null): string {
  if (!opts) return "Sandbox";
  if (opts.railLive) return "Live";
  if (opts.lifecycleForcesSandbox) return "Sandbox · training";
  if (opts.mode === "live") return opts.liveReady ? "Live" : "Live · not ready";
  return "Sandbox";
}

export type CaptureRoute =
  | { ok: true; mode: "sandbox" | "live" }
  | { ok: false; reason: "live-keys-while-training" | "missing-sandbox" | "missing-live" };

/**
 * Training does not use a local sandbox journal.
 * Sandbox keys post to Finix sandbox. Live keys wait until the location is live.
 */
export function finixCaptureRoute(opts: {
  locationLive: boolean;
  paymentsMode: "sandbox" | "live";
  sandboxKeys: boolean;
  liveKeys: boolean;
}): CaptureRoute {
  const useLiveHost = opts.locationLive && opts.paymentsMode === "live";
  if (!useLiveHost) {
    if (opts.sandboxKeys) return { ok: true, mode: "sandbox" };
    if (!opts.locationLive && opts.liveKeys) return { ok: false, reason: "live-keys-while-training" };
    return { ok: false, reason: "missing-sandbox" };
  }
  if (!opts.liveKeys) return { ok: false, reason: "missing-live" };
  return { ok: true, mode: "live" };
}
