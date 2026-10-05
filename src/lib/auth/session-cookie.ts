/**
 * Host-only session cookie for app.summex.app.
 * Secure + SameSite=Lax + Path=/. No Domain — a Domain attribute is rejected
 * on `__Host-` cookies and a parent Domain is not sent to the console host.
 */

const ATTR_SPLIT = /;\s*/;

function attrName(part: string): string {
  const eq = part.indexOf("=");
  return (eq === -1 ? part : part.slice(0, eq)).trim().toLowerCase();
}

/**
 * Split a comma-joined Set-Cookie header into individual cookies.
 * Commas inside Expires dates are not separators.
 */
export function splitSetCookieList(header: string): string[] {
  if (!header.trim()) return [];
  const result: string[] = [];
  let start = 0;
  for (let i = 0; i < header.length; i += 1) {
    if (header[i] !== ",") continue;
    let j = i + 1;
    while (j < header.length && header[j] === " ") j += 1;
    let k = j;
    while (
      k < header.length &&
      header[k] !== "=" &&
      header[k] !== ";" &&
      header[k] !== ","
    ) {
      k += 1;
    }
    if (k < header.length && header[k] === "=") {
      const part = header.slice(start, i).trim();
      if (part) result.push(part);
      start = j;
      i = j - 1;
    }
  }
  const last = header.slice(start).trim();
  if (last) result.push(last);
  return result;
}

/** Force host-only cookie attributes. Leaves the name=value pair unchanged. */
export function hostOnlySetCookie(header: string): string {
  const parts = header.split(ATTR_SPLIT).map((p) => p.trim()).filter(Boolean);
  const nv = parts[0];
  if (!nv || !nv.includes("=")) return header;
  const kept: string[] = [nv];
  let path = false;
  let secure = false;
  let sameSite = false;
  for (const part of parts.slice(1)) {
    const name = attrName(part);
    if (name === "domain") continue;
    if (name === "path") {
      kept.push("Path=/");
      path = true;
      continue;
    }
    if (name === "secure") {
      kept.push("Secure");
      secure = true;
      continue;
    }
    if (name === "samesite") {
      kept.push("SameSite=Lax");
      sameSite = true;
      continue;
    }
    kept.push(part);
  }
  if (!path) kept.push("Path=/");
  if (!secure) kept.push("Secure");
  if (!sameSite) kept.push("SameSite=Lax");
  return kept.join("; ");
}

export function readSetCookies(headers: Headers): string[] {
  if (typeof headers.getSetCookie === "function") {
    const list = headers.getSetCookie();
    if (list.length > 0) return list.flatMap(splitSetCookieList);
  }
  const raw = headers.get("set-cookie");
  return raw ? splitSetCookieList(raw) : [];
}

/** Copy the response with one host-only Set-Cookie header per cookie. */
export function withHostOnlySessionCookies(response: Response): Response {
  const cookies = readSetCookies(response.headers);
  if (cookies.length === 0) return response;
  const headers = new Headers(response.headers);
  headers.delete("set-cookie");
  for (const cookie of cookies) {
    headers.append("set-cookie", hostOnlySetCookie(cookie));
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
