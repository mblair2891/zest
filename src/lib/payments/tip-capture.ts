/**
 * Tip capture after a card authorization.
 * Training, sandbox, and a $0 tip still close the check when the processor
 * refuses the capture call. A live non-zero failure stays open so staff can
 * retry or close with no tip. An omitted tip is not treated as $0.
 */

export const TIP_CAPTURE_FAILED = "The tip could not be captured. The check stays open.";

/** Shown when a live tip capture fails. The check can still close at $0. */
export const TIP_PROCESSOR_DECLINED = "The processor did not add the tip.";

const TRAINING_LIFECYCLES = new Set([
  "onboarding",
  "awaiting_entities",
  "training",
  "scheduled_live",
]);

/**
 * Training and Quantum Payments sandbox close the check without a live capture.
 * A missing lifecycle or an unloaded pay status is not training by itself.
 */
export function cardCloseSimulatesTip(input: {
  lifecycleStatus?: string | null;
  paymentsMode?: string | null;
  lifecycleForcesSandbox?: boolean | null;
  captureSandbox?: boolean | null;
  serverSandbox?: boolean | null;
}): boolean {
  if (input.serverSandbox) return true;
  if (input.lifecycleForcesSandbox) return true;
  if (input.paymentsMode === "sandbox") return true;
  if (input.captureSandbox) return true;
  const life = input.lifecycleStatus ?? "";
  return TRAINING_LIFECYCLES.has(life);
}

/** Never leave the station on the generic stuck sentence. */
export function visibleTipFailure(error?: string | null): string {
  const message = String(error ?? "").trim();
  if (!message || message === TIP_CAPTURE_FAILED) return TIP_PROCESSOR_DECLINED;
  return message.slice(0, 200);
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Processor message from an error body. Empty when the body has none. */
export function finixEmbeddedMessage(json: Record<string, unknown> | null | undefined): string {
  if (!json || typeof json !== "object") return "";
  const embedded = json._embedded;
  if (embedded && typeof embedded === "object") {
    const errors = (embedded as { errors?: unknown }).errors;
    if (Array.isArray(errors)) {
      for (const row of errors) {
        if (!row || typeof row !== "object") continue;
        const message = textOf((row as { message?: unknown }).message);
        if (message) return message.slice(0, 200);
        const failure = textOf((row as { failure_message?: unknown }).failure_message);
        if (failure) return failure.slice(0, 200);
      }
    }
  }
  const top = textOf(json.failure_message) || textOf(json.message);
  return top.slice(0, 200);
}

const CAPTURED_STATE = new Set(["SUCCEEDED", "PENDING", ""]);

/**
 * An authorization that already has a transfer and a capture amount is captured.
 * A transfer id alone is not enough: an open authorization can name a transfer
 * before the tip is captured. A void is not a capture.
 */
export function finixAuthorizationAlreadyCaptured(json: Record<string, unknown> | null | undefined): {
  captured: boolean;
  transferId: string;
} {
  if (!json || typeof json !== "object") return { captured: false, transferId: "" };
  const voided = json.is_void === true || String(json.void_state ?? "").toUpperCase() === "SUCCEEDED";
  if (voided) return { captured: false, transferId: "" };
  const transfer = json.transfer;
  const transferId = typeof transfer === "string" ? transfer.trim() : "";
  const message = finixEmbeddedMessage(json);
  if (/already captured|has been captured|already been captured/i.test(message)) {
    return { captured: true, transferId };
  }
  const captureAmount = Number(json.capture_amount);
  const state = String(json.state ?? "").toUpperCase();
  if (transferId && Number.isFinite(captureAmount) && captureAmount > 0 && CAPTURED_STATE.has(state)) {
    return { captured: true, transferId };
  }
  return { captured: false, transferId: "" };
}

export function tipCaptureOutcome(input: {
  sandbox: boolean;
  capturedOk: boolean;
  error?: string;
  transferId?: string | null;
  authorizationId?: string | null;
  /** A zero tip closes the check even when the processor tip call fails. */
  tipCents?: number;
}): { ok: true; transferId: string | null; simulated: boolean } | { ok: false; error: string; simulated: false } {
  const transferId = String(input.transferId ?? "").trim();
  const authorizationId = String(input.authorizationId ?? "").trim();
  if (input.capturedOk) {
    return { ok: true, transferId: transferId || null, simulated: false };
  }
  const zeroTip =
    typeof input.tipCents === "number" && Number.isFinite(input.tipCents) && Math.round(input.tipCents) <= 0;
  if (authorizationId && (input.sandbox || zeroTip)) {
    return { ok: true, transferId: transferId || authorizationId, simulated: true };
  }
  const error = String(input.error ?? "").trim();
  return { ok: false, error: error || TIP_CAPTURE_FAILED, simulated: false };
}

function redactTipLog(value: string, max: number): string {
  return value.replace(/\d{13,19}/g, "[redacted]").slice(0, max);
}

/** Temporary tip-adjust trace. Remove after the close flow is confirmed. */
export function logTipAdjust(entry: {
  phase: "request" | "response";
  sandbox: boolean;
  simulated: boolean;
  authorizationId: string;
  captureAmountCents: number;
  tipCents: number;
  checkId?: string;
  ok?: boolean;
  status?: number;
  error?: string;
  transferId?: string;
  body?: string;
  /** Tip-only key. Never the sale authorization key. */
  idempotencyKey?: string;
  requestHeaders?: Record<string, string>;
}): void {
  const body = entry.body ? redactTipLog(entry.body, 400) : undefined;
  const requestHeaders = entry.requestHeaders
    ? Object.fromEntries(
        Object.entries(entry.requestHeaders)
          .filter(([name]) => !/authorization|password|cookie/i.test(name))
          .map(([name, value]) => [name, redactTipLog(value, 80)]),
      )
    : undefined;
  console.info(
    JSON.stringify({
      tag: "tip-adjust",
      phase: entry.phase,
      sandbox: entry.sandbox,
      simulated: entry.simulated,
      authorizationId: entry.authorizationId.slice(0, 80),
      captureAmountCents: entry.captureAmountCents,
      tipCents: entry.tipCents,
      checkId: entry.checkId ? entry.checkId.slice(0, 80) : undefined,
      ok: entry.ok,
      status: entry.status,
      error: entry.error ? redactTipLog(entry.error, 200) : undefined,
      transferId: entry.transferId ? entry.transferId.slice(0, 80) : undefined,
      idempotencyKey: entry.idempotencyKey ? redactTipLog(entry.idempotencyKey, 80) : undefined,
      requestHeaders,
      body,
    }),
  );
}
