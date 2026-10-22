import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "./tenant-middleware";

export const peekOnboardLinkFn = createServerFn({ method: "POST" })
  .validator((d: { token: string }) => ({ token: String(d.token ?? "") }))
  .handler(async ({ data }) => {
    const { peekOnboardLink } = await import("./onboard-link.server");
    return peekOnboardLink(data.token);
  });

export const acceptOnboardLinkFn = createServerFn({ method: "POST" })
  .validator((d: { token: string; password: string }) => ({
    token: String(d.token ?? ""),
    password: String(d.password ?? ""),
  }))
  .handler(async ({ data }) => {
    const { acceptOnboardLink } = await import("./onboard-link.server");
    return acceptOnboardLink(data);
  });

export const saveOnboardAgreementFn = createServerFn({ method: "POST" })
  .validator((d: { token: string; name: string }) => ({
    token: String(d.token ?? ""),
    name: String(d.name ?? "").trim().slice(0, 80),
  }))
  .handler(async ({ data }) => {
    const { saveOnboardAgreement } = await import("./onboard-link.server");
    return saveOnboardAgreement(data);
  });

export const startOnboardFinixFn = createServerFn({ method: "POST" })
  .validator((d: { token: string }) => ({ token: String(d.token ?? "") }))
  .handler(async ({ data }) => {
    const { startOnboardFinix } = await import("./onboard-link.server");
    return startOnboardFinix(data.token);
  });

export const emailOnboardFinixFn = createServerFn({ method: "POST" })
  .validator((d: { token: string }) => ({ token: String(d.token ?? "") }))
  .handler(async ({ data }) => {
    const { emailOnboardFinix } = await import("./onboard-link.server");
    return emailOnboardFinix(data.token);
  });

export const confirmEntityContactFn = createServerFn({ method: "POST" })
  .validator((d: { token: string; name: string; phone: string }) => ({
    token: String(d.token ?? ""),
    name: String(d.name ?? "").trim().slice(0, 80),
    phone: String(d.phone ?? "").trim().slice(0, 40),
  }))
  .handler(async ({ data }) => {
    const { confirmEntityContact } = await import("./onboard-link.server");
    return confirmEntityContact(data);
  });

export const completeOnboardLinkFn = createServerFn({ method: "POST" })
  .validator((d: { token: string }) => ({ token: String(d.token ?? "") }))
  .handler(async ({ data }) => {
    const { completeOnboardLink } = await import("./onboard-link.server");
    return completeOnboardLink(data.token);
  });

export const listLocationOnboardLinksFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { orgId: string; locationId: string }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: String(d.locationId ?? "").trim(),
  }))
  .handler(async ({ context, data }) => {
    const { listLocationOnboardLinks } = await import("./onboard-link.server");
    return listLocationOnboardLinks(context.userId, data.orgId, data.locationId);
  });

export const resendEntityOnboardLinkFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { orgId: string; operatorId: string }) => ({
    orgId: String(d.orgId ?? "").trim(),
    operatorId: String(d.operatorId ?? "").trim(),
  }))
  .handler(async ({ context, data }) => {
    const { resendEntityOnboardLink } = await import("./onboard-link.server");
    return resendEntityOnboardLink(context.userId, data);
  });
