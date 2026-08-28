import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { readServerEnv } from "@/lib/database-url";

const ALG = "aes-256-gcm";

function key(): Buffer | null {
  const secret =
    readServerEnv("HR_PII_SECRET") ||
    readServerEnv("BETTER_AUTH_SECRET") ||
    "";
  if (secret.length < 16) return null;
  return createHash("sha256").update(`summex-hr-pii:v1:${secret}`).digest();
}

export function piiReady(): boolean {
  return Boolean(key());
}

export function last4Ssn(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length < 4) return null;
  return d.slice(-4);
}

export function encryptPii(plain: string): string | null {
  const k = key();
  if (!k || !plain) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, k, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${enc.toString("base64url")}`;
}

export function decryptPii(blob: string | null | undefined): string | null {
  const k = key();
  if (!k || !blob) return null;
  const parts = blob.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  try {
    const iv = Buffer.from(parts[1]!, "base64url");
    const tag = Buffer.from(parts[2]!, "base64url");
    const enc = Buffer.from(parts[3]!, "base64url");
    const dec = createDecipheriv(ALG, k, iv);
    dec.setAuthTag(tag);
    return Buffer.concat([dec.update(enc), dec.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Never log this. Returns last4 + cipher, or error if SSN present but no key. */
export function packSsn(raw: string): { last4: string | null; cipher: string | null; error?: string } {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return { last4: null, cipher: null };
  const last4 = last4Ssn(digits);
  if (!piiReady()) {
    return { last4, cipher: null, error: "SSN not stored in full — set HR_PII_SECRET (or BETTER_AUTH_SECRET) to encrypt." };
  }
  return { last4, cipher: encryptPii(digits) };
}
