import { createServerFn } from "@tanstack/react-start";
import { optionalAuthMiddleware } from "@/lib/auth/middleware";
import type { HelpAskInput } from "./server";

function str(v: unknown, max: number): string {
  return String(v ?? "").trim().slice(0, max);
}

function bool(v: unknown): boolean {
  return v === true || v === "true";
}

export const askFloorHelpFn = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((d: Record<string, unknown>): HelpAskInput => {
    const views = Array.isArray(d.allowedViews) ? d.allowedViews : [];
    return {
      question: str(d.question, 500),
      role: str(d.role, 40),
      screen: str(d.screen, 40),
      deviceRole: str(d.deviceRole, 20),
      venueName: str(d.venueName, 80),
      entityName: str(d.entityName, 80),
      tableLabel: str(d.tableLabel, 40),
      peerVenue: bool(d.peerVenue),
      hostMulti: bool(d.hostMulti),
      qrMode: str(d.qrMode, 24),
      cashModel: str(d.cashModel, 40),
      paymentsLive: bool(d.paymentsLive),
      demoPins: bool(d.demoPins),
      allowedViews: views.map((v) => str(v, 40)).filter(Boolean).slice(0, 24),
      platformAdmin: bool(d.platformAdmin),
    };
  })
  .handler(async ({ data }) => {
    const { answerHelp } = await import("./server");
    return answerHelp(data);
  });
