/**
 * Tip capture after a card authorization.
 * A training or sandbox authorization still closes the check when the processor
 * refuses the capture call. A live failure stays open so staff can retry.
 */

export const TIP_CAPTURE_FAILED = "The tip could not be captured. The check stays open.";

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
}): { ok: true; transferId: string | null } | { ok: false; error: string } {
  if (input.capturedOk) {
    const transferId = String(input.transferId ?? "").trim();
    return { ok: true, transferId: transferId || null };
  }
  const authorizationId = String(input.authorizationId ?? "").trim();
  if (input.sandbox && authorizationId) {
    const transferId = String(input.transferId ?? "").trim();
    return { ok: true, transferId: transferId || authorizationId };
  }
  const error = String(input.error ?? "").trim();
  return { ok: false, error: error || TIP_CAPTURE_FAILED };
}
