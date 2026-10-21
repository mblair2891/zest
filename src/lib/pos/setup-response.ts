/** First-launch station setup: one JSON value, or a sentence the tablet can show. */

export const SETUP_READ_MESSAGE =
  "The station could not read the setup response. Try pairing again.";

const SESSION_SIGNED_OUT = JSON.stringify({ user: null, session: null });
const FRAME_HEADER = 9;
const MAX_SETUP_BODY = 512 * 1024;

export function setupLogSample(body: string): string {
  return body
    .replace(/password["']?\s*[:=]\s*\S+/gi, "password=[redacted]")
    .replace(/\s+/g, " ")
    .slice(0, 240);
}

export function logSetupPayload(where: string, status: number, body: string): void {
  console.error(`[setup] ${where} status=${status} body=${setupLogSample(body)}`);
}

/** True when the whole string is one JSON value. Trailing junk is rejected. */
export function isSingleJsonValue(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

export function staffSetupMessage(message: string): string | null {
  const text = message.trim();
  if (!text) return null;
  if (text === SETUP_READ_MESSAGE) return SETUP_READ_MESSAGE;
  if (
    /unexpected token|unexpected end of json|unexpected non-whitespace|in json at position|failed to fetch dynamically imported module|failed to load module script|disallowed mime type|is not valid json/i.test(
      text,
    )
  ) {
    return SETUP_READ_MESSAGE;
  }
  return null;
}

export function setupFailureResponse(): Response {
  return new Response(SETUP_READ_MESSAGE, {
    status: 502,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function copyHeaders(response: Response): Headers {
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  return headers;
}

function rebuildText(response: Response, text: string, headers = copyHeaders(response)): Response {
  return new Response(text, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function looksLikeHtml(text: string, contentType: string): boolean {
  if (contentType.includes("text/html")) return true;
  const start = text.trimStart().slice(0, 48).toLowerCase();
  return (
    start.startsWith("<!doctype") ||
    start.startsWith("<html") ||
    start.startsWith("<head") ||
    start.startsWith("<body")
  );
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>>
    0
  );
}

/** JSON frames in a TanStack framed body. A raw `{` payload is not a frame. */
export function framedJsonIsSingleValues(bytes: Uint8Array): { ok: boolean; sample: string } {
  if (bytes.byteLength === 0) return { ok: false, sample: "" };
  let offset = 0;
  let jsonFrames = 0;
  const decoder = new TextDecoder();
  while (offset < bytes.byteLength) {
    if (bytes.byteLength - offset < FRAME_HEADER) {
      return { ok: false, sample: decoder.decode(bytes.subarray(0, 80)) };
    }
    const type = bytes[offset]!;
    const streamId = readUint32(bytes, offset + 1);
    const length = readUint32(bytes, offset + 5);
    if (type > 3 || length > MAX_SETUP_BODY) {
      return { ok: false, sample: decoder.decode(bytes.subarray(0, 80)) };
    }
    if (type === 0 ? streamId !== 0 : streamId === 0) {
      return { ok: false, sample: decoder.decode(bytes.subarray(0, 80)) };
    }
    const start = offset + FRAME_HEADER;
    const end = start + length;
    if (end > bytes.byteLength) {
      return { ok: false, sample: decoder.decode(bytes.subarray(0, 80)) };
    }
    if (type === 0) {
      jsonFrames += 1;
      const payload = decoder.decode(bytes.subarray(start, end));
      if (!isSingleJsonValue(payload)) return { ok: false, sample: payload };
    }
    offset = end;
  }
  if (jsonFrames === 0) return { ok: false, sample: decoder.decode(bytes.subarray(0, 80)) };
  return { ok: true, sample: "" };
}

async function sanitizeFramed(response: Response, where: string): Promise<Response> {
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_SETUP_BODY) {
    return new Response(bytes, {
      status: response.status,
      statusText: response.statusText,
      headers: copyHeaders(response),
    });
  }
  const checked = framedJsonIsSingleValues(bytes);
  if (!checked.ok) {
    logSetupPayload(where, response.status, checked.sample);
    return setupFailureResponse();
  }
  return new Response(bytes, {
    status: response.status,
    statusText: response.statusText,
    headers: copyHeaders(response),
  });
}

/**
 * Server-function fetch. A single JSON value is returned unchanged.
 * HTML, an empty body, or more than one JSON value becomes a plain-text error
 * so the caller does not run JSON.parse on it.
 */
export async function sanitizeFetchedResponse(response: Response, where: string): Promise<Response> {
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/x-tss-framed")) {
    return sanitizeFramed(response, where);
  }
  const text = await response.text();
  if (looksLikeHtml(text, contentType)) {
    logSetupPayload(where, response.status, text);
    return setupFailureResponse();
  }
  const expectsJson =
    contentType.includes("json") ||
    response.headers.get("x-tss-serialized") === "true" ||
    contentType === "";
  if (!expectsJson) return rebuildText(response, text);
  if (!isSingleJsonValue(text)) {
    logSetupPayload(where, response.status, text);
    return setupFailureResponse();
  }
  if (!response.ok) logSetupPayload(where, response.status, text);
  const headers = copyHeaders(response);
  if (!contentType.includes("json")) headers.set("content-type", "application/json; charset=utf-8");
  return rebuildText(response, text, headers);
}

/** Auth responses, including get-session on an unpaired tablet. */
export async function sanitizeAuthResponse(response: Response, url: string): Promise<Response> {
  const session = url.includes("/get-session");
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const text = await response.text();
  if (contentType.includes("json") && isSingleJsonValue(text)) {
    return rebuildText(response, text);
  }
  if (!contentType.includes("json") && isSingleJsonValue(text) && !looksLikeHtml(text, contentType)) {
    const headers = copyHeaders(response);
    headers.set("content-type", "application/json; charset=utf-8");
    return rebuildText(response, text, headers);
  }
  logSetupPayload(session ? "get-session" : "auth", response.status, text);
  if (session) {
    return new Response(SESSION_SIGNED_OUT, {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
  const status = response.status >= 400 ? response.status : 502;
  const message = response.status === 429 ? "Too many requests" : SETUP_READ_MESSAGE;
  const code = response.status === 429 ? "TOO_MANY_REQUESTS" : "AUTH_RESPONSE";
  return new Response(JSON.stringify({ message, code }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
