import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "./middleware";

export type PlatformFlags = {
  isPlatformAdmin: boolean;
  mustChangePassword: boolean;
};

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
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not prepare sign-in";
      const dbDown =
        /database not ready|enoent|pglite|relation .* does not exist|econnrefused|enotfound|timeout/i.test(
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
