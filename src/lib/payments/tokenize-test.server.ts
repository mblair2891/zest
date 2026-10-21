/**
 * Platform admin sandbox tokenization test.
 * The browser sends a Finix token id. This server does not accept a card
 * number, an expiration, or a CVV, and it does not store the token.
 */
import { isPlatformAdmin } from "@/lib/saas/tenancy.server";
import { exchangeFinixCardToken } from "./finix";
import { missingFinixKeyMessage, readFinixApiCreds } from "./finix-keys";
import { cardNotPresentRejectsRawCard } from "./finix-tokenize";

const ADMIN_ONLY = "Online Tokenization Test is for a platform admin.";

export type SandboxTokenFormConfig =
  | { ok: true; environment: "sandbox"; applicationId: string }
  | { ok: false; error: string };

export type SandboxTokenExchange =
  | { ok: true; tokenId: string; instrumentId: string; last4: string | null }
  | { ok: false; error: string };

export async function sandboxTokenizationFormConfig(userId: string): Promise<SandboxTokenFormConfig> {
  if (!(await isPlatformAdmin(userId))) return { ok: false, error: ADMIN_ONLY };
  const creds = readFinixApiCreds("sandbox");
  if (!creds.ok) return { ok: false, error: missingFinixKeyMessage(creds.missing) };
  const applicationId = creds.creds.applicationId.trim();
  if (!applicationId) return { ok: false, error: missingFinixKeyMessage("FINIX_APPLICATION_ID") };
  return { ok: true, environment: "sandbox", applicationId };
}

export async function sandboxTokenizationExchange(
  userId: string,
  input: { token: string },
): Promise<SandboxTokenExchange> {
  if (!(await isPlatformAdmin(userId))) return { ok: false, error: ADMIN_ONLY };
  const rejected = cardNotPresentRejectsRawCard(input as unknown as Record<string, unknown>);
  if (rejected) return { ok: false, error: rejected };
  const exchanged = await exchangeFinixCardToken({ mode: "sandbox", token: input.token });
  if (!exchanged.ok) return exchanged;
  return {
    ok: true,
    tokenId: exchanged.tokenId,
    instrumentId: exchanged.instrumentId,
    last4: exchanged.last4,
  };
}
