import { inferNarrativeFacts } from "./interview-narrative";
import { emptyIntakeAnswers } from "./pricing";
import type { IntakeAnswers, IntakeModules } from "./prospect-types";
import type { OperatingModel } from "./location-model";

export const HOUSE_SHAPES = ["single", "host_operators", "peer_venue"] as const;
export type HouseShape = (typeof HOUSE_SHAPES)[number];

export const PRICE_WIZARD_STEPS = [
  "Shape",
  "Service",
  "Modules",
  "Counts",
  "Hardware",
  "Review",
  "Contact",
] as const;

export const PRICE_WIZARD_STEP_COUNT = PRICE_WIZARD_STEPS.length;

export const SERVICE_STYLES = ["counter", "full_service", "bar_only", "mixed", "hall"] as const;
export type ServiceStyle = (typeof SERVICE_STYLES)[number];

export const QR_CHOICES = ["off", "full", "reorder", "pay_only"] as const;
export type QrChoice = (typeof QR_CHOICES)[number];

export type WizardModuleId =
  | "kds"
  | "reservations"
  | "qr"
  | "kiosk"
  | "inventory"
  | "labor"
  | "hr"
  | "giftCards"
  | "multiLocationReporting";

export type PriceWizardState = {
  shape: HouseShape | null;
  style: ServiceStyle | null;
  modules: {
    kds: boolean;
    reservations: boolean;
    qr: QrChoice;
    kiosk: boolean;
    inventory: boolean;
    labor: boolean;
    hr: boolean;
    giftCards: boolean;
    multiLocationReporting: boolean;
  };
  locations: number;
  entities: number;
  seats: number;
  stations: number;
  kiosks: number;
  readers: number;
  legalName: string;
  email: string;
  describe: string;
};

export const HOUSE_SHAPE_LABEL: Record<HouseShape, string> = {
  single: "Single operator",
  host_operators: "Host + tenants",
  peer_venue: "Shared venue (peers)",
};

export const HOUSE_SHAPE_HINT: Record<HouseShape, string> = {
  single: "One brand, one merchant, one menu.",
  host_operators: "Host subscriber plus tenant operators. Host may sell.",
  peer_venue: "Two or more independent operators in one named building. No landlord POS.",
};

export const SERVICE_STYLE_LABEL: Record<ServiceStyle, string> = {
  counter: "Counter",
  full_service: "Full service",
  bar_only: "Bar-only",
  mixed: "Mixed dining + bar",
  hall: "Hall / stalls",
};

export const QR_CHOICE_LABEL: Record<QrChoice, string> = {
  off: "No guest QR",
  full: "Full — order and pay",
  reorder: "Reorder after staff open a check",
  pay_only: "Pay / split only",
};

export const WIZARD_MODULE_META: {
  id: WizardModuleId;
  label: string;
  hint: string;
}[] = [
  { id: "kds", label: "Kitchen / bar ODS", hint: "Tickets, Start / Bump, expo" },
  { id: "reservations", label: "Reservations / waitlist", hint: "Host stand, quoted wait, check-in" },
  { id: "qr", label: "QR order / pay", hint: "Table tents and ticket QR" },
  { id: "kiosk", label: "Guest kiosk", hint: "On-premise self-order" },
  { id: "inventory", label: "Inventory + recipes", hint: "Par, costing, purchasing" },
  { id: "labor", label: "Labor + scheduling", hint: "Shifts, tips, hours export" },
  { id: "hr", label: "HR packets", hint: "Onboarding packets, e-sign — Ops pack" },
  { id: "giftCards", label: "Gift cards", hint: "First-party ledger, not the card processor" },
  { id: "multiLocationReporting", label: "Multi-entity reporting", hint: "Roll-up across operators or sites" },
];

export function emptyPriceWizard(): PriceWizardState {
  return {
    shape: null,
    style: null,
    modules: {
      kds: false,
      reservations: false,
      qr: "off",
      kiosk: false,
      inventory: false,
      labor: false,
      hr: false,
      giftCards: false,
      multiLocationReporting: false,
    },
    locations: 1,
    entities: 1,
    seats: 12,
    stations: 2,
    kiosks: 0,
    readers: 1,
    legalName: "",
    email: "",
    describe: "",
  };
}

export function stylesForShape(shape: HouseShape | null): ServiceStyle[] {
  if (shape === "host_operators") return ["full_service", "mixed", "hall"];
  if (shape === "peer_venue") return ["mixed", "hall", "bar_only"];
  if (shape === "single") return ["counter", "full_service", "bar_only", "mixed"];
  return [...SERVICE_STYLES];
}

export function clampWizardStep(step: unknown): number {
  const n = Math.round(Number(step));
  if (!Number.isInteger(n) || n < 1) return 1;
  if (n > PRICE_WIZARD_STEPS.length) return PRICE_WIZARD_STEPS.length;
  return n;
}

/** Set a house shape. Never clears — pick another shape to change. */
export function selectHouseShape(state: PriceWizardState, shape: HouseShape): PriceWizardState {
  return clampWizard({ ...state, shape });
}

export function clampWizard(state: PriceWizardState): PriceWizardState {
  const next = { ...state, modules: { ...state.modules } };
  const allowed = stylesForShape(next.shape);
  if (next.style && !allowed.includes(next.style)) next.style = null;
  if (next.shape === "single") next.entities = 1;
  if (next.shape === "peer_venue") next.entities = Math.max(2, next.entities || 2);
  if (next.shape === "host_operators") next.entities = Math.max(1, next.entities || 1);
  if (next.style === "counter" || next.style === "bar_only") next.modules.reservations = false;
  if (next.shape === "single" && next.locations < 2) next.modules.multiLocationReporting = false;
  if (!next.modules.kiosk) next.kiosks = 0;
  if (next.modules.kiosk && next.kiosks < 1) next.kiosks = 1;
  next.locations = Math.max(1, Math.min(99, Math.round(next.locations) || 1));
  next.entities = Math.max(1, Math.min(40, Math.round(next.entities) || 1));
  next.seats = Math.max(0, Math.min(5000, Math.round(next.seats) || 0));
  next.stations = Math.max(1, Math.min(80, Math.round(next.stations) || 1));
  next.kiosks = Math.max(0, Math.min(40, Math.round(next.kiosks) || 0));
  next.readers = Math.max(1, Math.min(80, Math.round(next.readers) || 1));
  return next;
}

export function visibleModules(state: PriceWizardState): WizardModuleId[] {
  return WIZARD_MODULE_META.map((m) => m.id).filter((id) => {
    if (id === "reservations" && (state.style === "counter" || state.style === "bar_only")) return false;
    if (id === "multiLocationReporting") {
      if (state.shape === "single" && state.locations < 2) return false;
    }
    return true;
  });
}

export function wizardToIntake(state: PriceWizardState): IntakeAnswers {
  const s = clampWizard(state);
  const a = emptyIntakeAnswers();
  a.company = {
    ...a.company,
    legalName: s.legalName.trim(),
    billingEmail: s.email.trim().toLowerCase(),
  };
  const style = s.style;
  const typeCounts: IntakeAnswers["portfolio"]["typeCounts"] = {};
  if (style === "hall" || s.shape === "host_operators" || s.shape === "peer_venue") {
    if (style === "hall") typeCounts.food_hall = s.locations;
    else if (style === "bar_only") typeCounts.bar_lounge = s.locations;
    else if (style === "mixed") {
      typeCounts.restaurant = s.locations;
      typeCounts.bar_lounge = s.locations;
    } else if (style === "full_service") typeCounts.restaurant = s.locations;
    else typeCounts.food_hall = s.locations;
  } else if (style === "bar_only") typeCounts.bar_lounge = s.locations;
  else if (style === "counter") typeCounts.cafe = s.locations;
  else if (style === "mixed") {
    typeCounts.restaurant = s.locations;
    typeCounts.bar_lounge = s.locations;
  } else {
    typeCounts.restaurant = s.locations;
  }
  if (s.shape === "single") {
    delete typeCounts.food_hall;
    delete typeCounts.truck_pod;
    if (!Object.keys(typeCounts).length) typeCounts.cafe = s.locations;
  }
  a.portfolio = {
    locationsNow: s.locations,
    locations12mo: s.locations,
    typeCounts,
  };
  const shape: OperatingModel = s.shape ?? "single";
  const entities =
    shape === "single" ? 1 : shape === "peer_venue" ? Math.max(2, s.entities) : Math.max(1, s.entities);
  a.operating = {
    model: shape,
    operatorsPerLocation: entities,
    guestPaysHostCheck: shape !== "single",
    barKitchenSplit: style === "mixed" || style === "hall" || style === "bar_only",
    hostStand: s.modules.reservations || style === "full_service" || style === "mixed" || style === "hall",
  };
  const mods: IntakeModules = {
    tableService: s.modules.reservations || style === "full_service" || style === "mixed",
    counterQsr: style === "counter",
    kiosk: s.modules.kiosk || s.kiosks > 0,
    online: s.modules.qr !== "off",
    kds: s.modules.kds || style === "bar_only" || style === "hall" || style === "mixed",
    inventory: s.modules.inventory,
    labor: s.modules.labor || s.modules.hr,
    giftCards: s.modules.giftCards,
    crm: false,
    marketing: false,
    vendorPortal: shape !== "single",
    multiLocationReporting: s.modules.multiLocationReporting,
  };
  a.modules = mods;
  const ods = mods.kds ? 1 : 0;
  a.volume = {
    ...a.volume,
    staffSeats: Math.max(1, s.seats || 8),
    orderStations: s.stations,
    odsStations: ods,
    kioskCount: mods.kiosk ? Math.max(1, s.kiosks) : 0,
    peakDevices: Math.max(1, s.stations + ods + (mods.kiosk ? Math.max(1, s.kiosks) : 0)),
    terminalNeed: "buy",
  };
  a.hardware = {
    ownsTabletsPrintersDrawers: true,
    shipReaders: true,
    readerQty: s.readers,
    readerPay: "purchase",
    shipPartnerDevices: false,
    partnerSkuQty: {},
  };
  a.payments = {
    ...a.payments,
    quantumPaymentsAck: true,
  };
  const notes = [
    s.describe.trim() ? `Description: ${s.describe.trim()}` : "",
    `wizard shape=${shape} style=${style ?? "unset"} qr=${s.modules.qr}`,
    s.modules.hr ? "HR packets selected." : "",
  ]
    .filter(Boolean)
    .join("\n");
  a.timeline = { goLiveDate: "", notes };
  return a;
}

export function answersToWizard(answers: IntakeAnswers): PriceWizardState {
  const w = emptyPriceWizard();
  const model = answers.operating.model;
  w.shape = model === "peer_venue" || model === "host_operators" ? model : "single";
  const types = answers.portfolio.typeCounts;
  if ((types.food_hall ?? 0) > 0 || (types.truck_pod ?? 0) > 0) w.style = "hall";
  else if ((types.bar_lounge ?? 0) > 0 && (types.restaurant ?? 0) > 0) w.style = "mixed";
  else if ((types.bar_lounge ?? 0) > 0 && !answers.modules.tableService) w.style = "bar_only";
  else if (answers.modules.counterQsr) w.style = "counter";
  else if (answers.modules.tableService) w.style = "full_service";
  else w.style = "counter";
  w.modules.kds = answers.modules.kds;
  w.modules.reservations = answers.modules.tableService || answers.operating.hostStand;
  const notes = answers.timeline.notes || "";
  const qr = notes.match(/qr=(off|full|reorder|pay_only)/);
  w.modules.qr = qr ? (qr[1] as QrChoice) : answers.modules.online ? "full" : "off";
  w.modules.kiosk = answers.modules.kiosk;
  w.modules.inventory = answers.modules.inventory;
  w.modules.labor = answers.modules.labor;
  w.modules.hr = /HR packets/i.test(notes);
  w.modules.giftCards = answers.modules.giftCards;
  w.modules.multiLocationReporting = answers.modules.multiLocationReporting;
  w.locations = Math.max(1, answers.portfolio.locationsNow || 1);
  w.entities = w.shape === "single" ? 1 : Math.max(w.shape === "peer_venue" ? 2 : 1, answers.operating.operatorsPerLocation);
  w.seats = answers.volume.staffSeats;
  w.stations = answers.volume.orderStations;
  w.kiosks = answers.volume.kioskCount;
  w.readers = answers.hardware?.readerQty || 1;
  w.legalName = answers.company.legalName;
  w.email = answers.company.billingEmail;
  return clampWizard(w);
}

export function prefillFromDescription(text: string): PriceWizardState {
  const w = emptyPriceWizard();
  w.describe = text;
  const facts = inferNarrativeFacts(text.toLowerCase());
  if (facts.peerLikely || facts.operatorCount >= 2) w.shape = "peer_venue";
  else if (facts.hostLikely || facts.hostCompanyLikely) w.shape = "host_operators";
  else w.shape = "single";
  if (facts.shape === "hall" || w.shape !== "single") w.style = w.shape === "single" ? "mixed" : "hall";
  else if (facts.shape === "bar") w.style = "bar_only";
  else if (facts.shape === "full_service") w.style = "full_service";
  else if (facts.shape === "cafe" || facts.shape === "qsr") w.style = "counter";
  else if (facts.hasBar && facts.hasFloor) w.style = "mixed";
  else if (facts.hasFloor) w.style = "full_service";
  else w.style = "counter";
  w.modules.kds = facts.hasKitchen || facts.hasBar || facts.shape === "hall";
  w.modules.reservations = facts.reservations || facts.waitlist || facts.fullServiceFloor;
  w.modules.qr = facts.online ? "full" : "off";
  w.modules.kiosk = facts.kiosk;
  w.modules.inventory = /inventory|recipe|costing/i.test(text);
  w.modules.labor = /labor|schedule|staff/i.test(text);
  w.modules.hr = /hr packet|onboarding packet/i.test(text);
  w.modules.giftCards = facts.cashVsCard && /gift/i.test(text);
  w.locations = Math.max(1, facts.locCount || 1);
  w.entities = w.shape === "peer_venue" ? Math.max(2, facts.operatorCount || 2) : w.shape === "host_operators" ? Math.max(1, facts.operatorCount || 1) : 1;
  if (facts.seats) w.seats = facts.seats;
  if (facts.devices) w.stations = facts.devices;
  return clampWizard(w);
}

export function parsePriceWizard(raw: unknown): PriceWizardState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!("shape" in o) && !("style" in o) && !("modules" in o)) return null;
  const w = emptyPriceWizard();
  const shape = String(o.shape ?? "");
  w.shape = HOUSE_SHAPES.includes(shape as HouseShape) ? (shape as HouseShape) : null;
  const style = String(o.style ?? "");
  w.style = SERVICE_STYLES.includes(style as ServiceStyle) ? (style as ServiceStyle) : null;
  const m = o.modules && typeof o.modules === "object" ? (o.modules as Record<string, unknown>) : {};
  w.modules.kds = m.kds === true;
  w.modules.reservations = m.reservations === true;
  const qr = String(m.qr ?? "off");
  w.modules.qr = QR_CHOICES.includes(qr as QrChoice) ? (qr as QrChoice) : "off";
  w.modules.kiosk = m.kiosk === true;
  w.modules.inventory = m.inventory === true;
  w.modules.labor = m.labor === true;
  w.modules.hr = m.hr === true;
  w.modules.giftCards = m.giftCards === true;
  w.modules.multiLocationReporting = m.multiLocationReporting === true;
  const n = (v: unknown, fallback: number) => {
    const x = Math.round(Number(v));
    return Number.isFinite(x) ? x : fallback;
  };
  w.locations = n(o.locations, 1);
  w.entities = n(o.entities, 1);
  w.seats = n(o.seats, 12);
  w.stations = n(o.stations, 2);
  w.kiosks = n(o.kiosks, 0);
  w.readers = n(o.readers, 1);
  w.legalName = typeof o.legalName === "string" ? o.legalName : "";
  w.email = typeof o.email === "string" ? o.email : "";
  w.describe = typeof o.describe === "string" ? o.describe : "";
  return clampWizard(w);
}
