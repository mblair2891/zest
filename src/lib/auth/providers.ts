/**
 * Social / OAuth providers offered at sign-in.
 *
 * Summex is username (or email) + password only. Keep this list empty so
 * Better Auth does not register Google, X, or other broker upstreams, and the
 * client never renders “Continue with…” buttons.
 */
export type GrokProvider = {
  /** This app's local provider id; also the callback path segment. */
  providerId: string;
  /** Upstream hint the broker forwards to (Better Auth social id). */
  idp: string;
  /** Human label for the sign-in button. */
  label: string;
};

export const GROK_PROVIDERS: readonly GrokProvider[] = [];
