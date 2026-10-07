import { createMiddleware } from "@tanstack/react-start";

/**
 * Password session when one exists. A signed-out caller continues with
 * userId null so a paired tablet can prove a PIN instead.
 */
export const floorSessionMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("@/lib/auth/client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    assertSameSiteRequest();
    const user = await getSessionUser(context.bearerToken);
    return next({ context: { userId: user?.id ?? null } });
  });
