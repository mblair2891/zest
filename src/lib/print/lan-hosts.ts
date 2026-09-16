/** RFC1918 hosts the Android print plugin may open TCP 9100 to. Not WebView HTTP. */

export function isPrintLanHost(raw: string | null | undefined): boolean {
  const host = String(raw ?? "").trim().replace(/^\[|\]$/g, "");
  if (!host) return false;
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const c = Number(m[3]);
  const d = Number(m[4]);
  if ([a, b, c, d].some((n) => n > 255)) return false;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  return false;
}
