import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { CASH_MODEL_LABEL } from "@/lib/pos/cash-handling";
import { readStationDeviceRole } from "@/lib/pos/device-roles";
import { viewsForRole } from "@/lib/pos/rbac";
import { usePosStore } from "@/lib/pos/store";
import { useStationSessionStore } from "@/lib/pos/station-session";
import type { EmployeeRole, PosView } from "@/lib/pos/types";
import { isProspectDemo } from "@/lib/demo/session";
import type { HelpAskInput } from "./server";


const VIEW_LABEL: Partial<Record<PosView, string>> = {
  hq: "Home",
  floor: "Floor",
  order: "Order",
  kitchen: "Kitchen ODS",
  bar: "Bar ODS",
  waitlist: "Host",
  takeout: "Takeout",
  settings: "Settings",
  cash: "Cash",
  employees: "Users",
  menu: "Menu",
  reports: "Reports",
  labor: "Labor",
  hr: "HR",
  settlement: "Settle",
};

function allowedLabels(role: EmployeeRole | null): string[] {
  if (!role) return [];
  const views = viewsForRole(role);
  if (views === "all") return ["Home", "Floor", "Order", "Kitchen ODS", "Host", "Settings", "Cash", "Menu", "Users"];
  return views.map((v) => VIEW_LABEL[v] ?? v);
}

export type HelpSurface = "pos" | "pin" | "platform" | "kiosk";

export function buildHelpContext(surface: HelpSurface): HelpAskInput {
  const pos = usePosStore.getState();
  const settings = pos.settings;
  const emp = pos.employees.find((e) => e.id === pos.currentEmployeeId);
  const table = pos.tables.find((t) => t.id === pos.activeTableId);
  const device = readStationDeviceRole() ?? "";
  const assignment = useStationSessionStore.getState().assignment;
  const op =
    assignment.operatorId && assignment.operatorId !== HOST_SCOPE
      ? pos.vendors.find((v) => v.id === assignment.operatorId)
      : null;
  const peer = Boolean(settings.peerVenue || settings.operatingModel === "peer_venue");
  const hostMulti = Boolean(settings.hostMultiOperator || settings.operatingModel === "host_operators");
  const cash = settings.cashHandling?.defaultModel
    ? CASH_MODEL_LABEL[settings.cashHandling.defaultModel] || settings.cashHandling.defaultModel
    : "unset";
  const qr = String(settings.qrMode ?? "hybrid");
  const live = settings.lifecycleStatus === "live";
  const screen =
    surface === "pin"
      ? "PIN pad"
      : surface === "platform"
        ? "Platform"
        : surface === "kiosk"
          ? "Kiosk"
          : String(pos.view ?? "floor");

  if (surface === "platform") {
    return {
      question: "",
      role: "platform_admin",
      screen: "Platform",
      deviceRole: device || "host",
      venueName: settings.name || "Platform",
      entityName: "",
      tableLabel: "",
      peerVenue: false,
      hostMulti: false,
      qrMode: qr,
      cashModel: cash,
      paymentsLive: false,
      demoPins: false,
      allowedViews: ["CRM", "Pipeline", "Tenants", "Settings"],
      platformAdmin: true,
    };
  }

  return {
    question: "",
    role: emp?.role || (surface === "pin" ? "" : ""),
    screen,
    deviceRole: device || String(assignment.kind || ""),
    venueName: settings.name || "",
    entityName: op?.name || "",
    tableLabel: table?.label || "",
    peerVenue: peer,
    hostMulti,
    qrMode: qr,
    cashModel: cash,
    paymentsLive: Boolean(live),
    demoPins: isProspectDemo(),
    allowedViews: allowedLabels(emp?.role ?? null),
    platformAdmin: false,
  };
}
