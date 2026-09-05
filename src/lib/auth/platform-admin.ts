import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "./middleware";

export type PlatformFlags = {
  isPlatformAdmin: boolean;
  mustChangePassword: boolean;
};

/** Client-only: SessionGate reads this so a just-cleared flag cannot bounce back. */
const MUST_CHANGE_CLEARED_EVENT = "summex:must-change-password-cleared";
const MUST_CHANGE_CLEARED_KEY = "summex-must-change-cleared";
const MUST_CHANGE_CLEARED_MS = 30_000;

export function markMustChangePasswordCleared(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(MUST_CHANGE_CLEARED_KEY, String(Date.now()));
  window.dispatchEvent(new Event(MUST_CHANGE_CLEARED_EVENT));
}

export function wasMustChangePasswordCleared(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.sessionStorage.getItem(MUST_CHANGE_CLEARED_KEY);
  const at = Number(raw);
  if (!Number.isFinite(at) || at <= 0) return false;
  return Date.now() - at < MUST_CHANGE_CLEARED_MS;
}

export function subscribeMustChangePasswordCleared(fn: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(MUST_CHANGE_CLEARED_EVENT, fn);
  return () => window.removeEventListener(MUST_CHANGE_CLEARED_EVENT, fn);
}

export const getPlatformFlags = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<PlatformFlags> => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{ must_change_password: boolean }>`
      select must_change_password from platform_admin
      where user_id = ${context.userId}
      limit 1
    `;
    if (!rows[0]) {
      return { isPlatformAdmin: false, mustChangePassword: false };
    }
    return {
      isPlatformAdmin: true,
      mustChangePassword: Boolean(rows[0].must_change_password),
    };
  });

export const clearMustChangePassword = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      update platform_admin
      set must_change_password = false
      where user_id = ${context.userId}
    `;
    return { ok: true };
  });

export const ensureAdminExists = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true } | { ok: false; error: string }> => {
    try {
      const { ensurePlatformAdmin } = await import("./bootstrap-admin.server");
      await ensurePlatformAdmin();
      try {
        const { purgeSeededDemoData } = await import("@/lib/demo/purge-seed.server");
        await purgeSeededDemoData();
      } catch (err) {
        console.error("[auth] demo purge skipped:", err);
      }
      try {
        const { ensureLaundryPeerVenue } = await import("@/lib/saas/laundry-peer-seed.server");
        await ensureLaundryPeerVenue();
      } catch (err) {
        console.error("[auth] The Laundry peer venue seed skipped:", err);
      }
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not prepare sign-in";
      const dbDown =
        /database not ready|database_url required|enoent|pglite|relation .* does not exist|econnrefused|enotfound|timeout/i.test(
          msg,
        );
      return {
        ok: false,
        error: dbDown ? "Database not ready" : "Could not prepare sign-in. Try again.",
      };
    }
  },
);

export const changePasswordInput = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

/**
 * Change the signed-in platform admin password without revoking the current
 * session. Clears `must_change_password` in the same request.
 */
export const changePlatformAdminPassword = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { currentPassword: string; newPassword: string }) =>
    changePasswordInput.parse({
      currentPassword: String(d.currentPassword ?? ""),
      newPassword: String(d.newPassword ?? ""),
    }),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { changePlatformAdminPasswordForUser } = await import(
      "./change-password.server"
    );
    return changePlatformAdminPasswordForUser(context.userId, data);
  });
