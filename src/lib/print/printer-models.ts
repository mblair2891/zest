/** Hospitality LAN printer presets. Types stay Receipt | Order; model is not a type. */

export type PrinterFamily = "star" | "epson" | "citizen" | "bixolon" | "generic";
export type PrinterEmulation = "escpos" | "star_line" | "starprnt";
export type PrinterMechanism = "thermal" | "impact";
export type PrinterPaperMm = 58 | 76 | 80;
export type PrinterCutter = "full" | "partial" | "none";
export type PrinterModelGroupId = "star" | "epson" | "citizen" | "bixolon" | "other";

export type PrinterModelPreset =
  | "star_sp700"
  | "star_tsp100"
  | "star_tsp650"
  | "star_tsp700"
  | "star_mc_print"
  | "star_mc_label3"
  | "star_line"
  | "epson_tm_t20"
  | "epson_tm_t88"
  | "epson_tm_m30"
  | "epson_tm_u220"
  | "epson_escpos"
  | "citizen_ct_s310"
  | "citizen_escpos"
  | "bixolon_srp_330"
  | "bixolon_escpos"
  | "snbc_ithaca"
  | "seiko_rp"
  | "generic_posx"
  | "generic_escpos"
  | "generic_escpos_58";

export type PrinterModelSpec = {
  id: PrinterModelPreset;
  label: string;
  group: PrinterModelGroupId;
  family: PrinterFamily;
  emulation: PrinterEmulation;
  mechanism: PrinterMechanism;
  paperWidthMm: PrinterPaperMm;
  cutter: PrinterCutter;
  port: 9100;
  defaultFor?: "receipt" | "order";
};

export const DEFAULT_PRINTER_PORT = 9100;

export const PRINTER_FAMILIES: PrinterFamily[] = [
  "star",
  "epson",
  "citizen",
  "bixolon",
  "generic",
];

export const PRINTER_FAMILY_LABEL: Record<PrinterFamily, string> = {
  star: "Star Micronics",
  epson: "Epson",
  citizen: "Citizen",
  bixolon: "Bixolon",
  generic: "Generic ESC/POS",
};

export const PRINTER_EMULATION_LABEL: Record<PrinterEmulation, string> = {
  escpos: "ESC/POS",
  star_line: "Star Line Mode",
  starprnt: "StarPRNT",
};

export const PRINTER_CUTTER_LABEL: Record<PrinterCutter, string> = {
  full: "full cutter",
  partial: "partial cutter",
  none: "no cutter",
};

const SPECS: PrinterModelSpec[] = [
  {
    id: "star_sp700",
    label: "Star SP700 / SP742 / SP712 / SP717 (impact kitchen)",
    group: "star",
    family: "star",
    emulation: "star_line",
    mechanism: "impact",
    paperWidthMm: 76,
    cutter: "partial",
    port: 9100,
    defaultFor: "order",
  },
  {
    id: "star_tsp100",
    label: "Star TSP100 / TSP143 III / IV",
    group: "star",
    family: "star",
    emulation: "starprnt",
    mechanism: "thermal",
    paperWidthMm: 80,
    cutter: "full",
    port: 9100,
  },
  {
    id: "star_tsp650",
    label: "Star TSP650 / TSP650II",
    group: "star",
    family: "star",
    emulation: "starprnt",
    mechanism: "thermal",
    paperWidthMm: 80,
    cutter: "full",
    port: 9100,
  },
  {
    id: "star_tsp700",
    label: "Star TSP700II / TSP800II",
    group: "star",
    family: "star",
    emulation: "starprnt",
    mechanism: "thermal",
    paperWidthMm: 80,
    cutter: "full",
    port: 9100,
  },
  {
    id: "star_mc_print",
    label: "Star mC-Print2 / mC-Print3",
    group: "star",
    family: "star",
    emulation: "starprnt",
    mechanism: "thermal",
    paperWidthMm: 80,
    cutter: "full",
    port: 9100,
  },
  {
    id: "star_mc_label3",
    label: "Star mC-Label3",
    group: "star",
    family: "star",
    emulation: "starprnt",
    mechanism: "thermal",
    paperWidthMm: 58,
    cutter: "none",
    port: 9100,
  },
  {
    id: "star_line",
    label: "Star generic StarPRNT / Star Line Mode",
    group: "star",
    family: "star",
    emulation: "star_line",
    mechanism: "thermal",
    paperWidthMm: 80,
    cutter: "partial",
    port: 9100,
  },
  {
    id: "epson_tm_t20",
    label: "Epson TM-T20 / T20III",
    group: "epson",
    family: "epson",
    emulation: "escpos",
    mechanism: "thermal",
    paperWidthMm: 80,
    cutter: "full",
    port: 9100,
    defaultFor: "receipt",
  },
  {
    id: "epson_tm_t88",
    label: "Epson TM-T88V / T88VI / T88VII",
    group: "epson",
    family: "epson",
    emulation: "escpos",
    mechanism: "thermal",
    paperWidthMm: 80,
    cutter: "full",
    port: 9100,
  },
  {
    id: "epson_tm_m30",
    label: "Epson TM-m30 / TM-m30III",
    group: "epson",
    family: "epson",
    emulation: "escpos",
    mechanism: "thermal",
    paperWidthMm: 80,
    cutter: "full",
    port: 9100,
  },
  {
    id: "epson_tm_u220",
    label: "Epson TM-U220 (impact kitchen)",
    group: "epson",
    family: "epson",
    emulation: "escpos",
    mechanism: "thermal",
    paperWidthMm: 76,
    cutter: "none",
    port: 9100,
  },
  {
    id: "epson_escpos",
    label: "Epson generic ESC/POS",
    group: "epson",
    family: "epson",
    emulation: "escpos",
    mechanism: "thermal",
    paperWidthMm: 80,
    cutter: "full",
    port: 9100,
  },
  {
    id: "citizen_ct_s310",
    label: "Citizen CT-S310II / CT-S4000",
    group: "citizen",
    family: "citizen",
    emulation: "escpos",
    mechanism: "thermal",
    paperWidthMm: 80,
    cutter: "full",
    port: 9100,
  },
  {
    id: "citizen_escpos",
    label: "Citizen generic ESC/POS",
    group: "citizen",
    family: "citizen",
    emulation: "escpos",
    mechanism: "thermal",
    paperWidthMm: 80,
    cutter: "full",
    port: 9100,
  },
  {
    id: "bixolon_srp_330",
    label: "Bixolon SRP-330 / SRP-350",
    group: "bixolon",
    family: "bixolon",
    emulation: "escpos",
    mechanism: "thermal",
    paperWidthMm: 80,
    cutter: "full",
    port: 9100,
  },
  {
    id: "bixolon_escpos",
    label: "Bixolon generic ESC/POS",
    group: "bixolon",
    family: "bixolon",
    emulation: "escpos",
    mechanism: "thermal",
    paperWidthMm: 80,
    cutter: "full",
    port: 9100,
  },
  {
    id: "snbc_ithaca",
    label: "SNBC / Ithaca / Transact",
    group: "other",
    family: "generic",
    emulation: "escpos",
    mechanism: "thermal",
    paperWidthMm: 80,
    cutter: "full",
    port: 9100,
  },
  {
    id: "seiko_rp",
    label: "Seiko RP series",
    group: "other",
    family: "generic",
    emulation: "escpos",
    mechanism: "thermal",
    paperWidthMm: 80,
    cutter: "full",
    port: 9100,
  },
  {
    id: "generic_posx",
    label: "POS-X / Rongta / generic 80mm ESC/POS",
    group: "other",
    family: "generic",
    emulation: "escpos",
    mechanism: "thermal",
    paperWidthMm: 80,
    cutter: "full",
    port: 9100,
  },
  {
    id: "generic_escpos_58",
    label: "Generic 58mm ESC/POS (kiosk / narrow)",
    group: "other",
    family: "generic",
    emulation: "escpos",
    mechanism: "thermal",
    paperWidthMm: 58,
    cutter: "full",
    port: 9100,
  },
  {
    id: "generic_escpos",
    label: "Generic ESC/POS (80mm)",
    group: "other",
    family: "generic",
    emulation: "escpos",
    mechanism: "thermal",
    paperWidthMm: 80,
    cutter: "full",
    port: 9100,
  },
];

export const PRINTER_MODEL_PRESETS: PrinterModelPreset[] = SPECS.map((s) => s.id);

export const PRINTER_MODEL_LABEL: Record<PrinterModelPreset, string> = Object.fromEntries(
  SPECS.map((s) => [s.id, s.label]),
) as Record<PrinterModelPreset, string>;

export const PRINTER_MODEL_GROUP_LABEL: Record<PrinterModelGroupId, string> = {
  star: "Star Micronics",
  epson: "Epson",
  citizen: "Citizen",
  bixolon: "Bixolon",
  other: "Other common ESC/POS",
};

export const PRINTER_MODEL_GROUPS: Array<{
  id: PrinterModelGroupId;
  label: string;
  models: PrinterModelPreset[];
}> = (["star", "epson", "citizen", "bixolon", "other"] as PrinterModelGroupId[]).map((id) => ({
  id,
  label: PRINTER_MODEL_GROUP_LABEL[id],
  models: SPECS.filter((s) => s.group === id).map((s) => s.id),
}));

const BY_ID = new Map(SPECS.map((s) => [s.id, s]));

export function isPrinterModelPreset(raw: string | null | undefined): raw is PrinterModelPreset {
  return Boolean(raw && BY_ID.has(raw as PrinterModelPreset));
}

export function printerModelSpec(preset: PrinterModelPreset): PrinterModelSpec {
  return BY_ID.get(preset) ?? BY_ID.get("generic_escpos")!;
}

export function defaultPrinterModel(kind: "receipt" | "order"): PrinterModelPreset {
  return kind === "order" ? "star_sp700" : "epson_tm_t20";
}

export function familyFromModelPreset(preset: PrinterModelPreset): PrinterFamily {
  return printerModelSpec(preset).family;
}

export function modelPresetFromFamily(
  family: PrinterFamily,
  station?: "kitchen" | "bar" | "receipt" | "expo" | "label",
): PrinterModelPreset {
  if (station && station !== "receipt") {
    if (family === "star") return "star_sp700";
    if (family === "epson") return "epson_tm_u220";
    return "generic_escpos";
  }
  if (family === "star") return "star_tsp100";
  if (family === "epson") return "epson_tm_t20";
  if (family === "citizen") return "citizen_ct_s310";
  if (family === "bixolon") return "bixolon_srp_330";
  return "generic_escpos";
}

export function colsForPaperWidth(mm: PrinterPaperMm): number {
  if (mm <= 58) return 32;
  if (mm <= 76) return 40;
  return 42;
}

export function printerModelHint(preset: PrinterModelPreset): string {
  const s = printerModelSpec(preset);
  const mech = s.mechanism === "impact" ? "impact 7x9" : "thermal";
  return `${PRINTER_EMULATION_LABEL[s.emulation]} · ${mech} · ${s.paperWidthMm}mm · ${PRINTER_CUTTER_LABEL[s.cutter]} · port ${s.port}`;
}

export function isImpactPrinterModel(preset?: PrinterModelPreset | null): boolean {
  if (!preset) return false;
  return printerModelSpec(preset).mechanism === "impact";
}

export function parseLanTarget(
  ip?: string | null,
  port?: number | null,
  target?: string | null,
): { host: string; port: number; target: string } | null {
  const fromTarget = String(target ?? "").trim();
  let host = String(ip ?? "").trim();
  let p = Number(port) > 0 ? Math.round(Number(port)) : 0;
  if (!host && fromTarget) {
    const [h, portStr] = fromTarget.includes(":") ? fromTarget.split(":") : [fromTarget, ""];
    host = (h || "").trim();
    if (!p) p = Number(portStr) || DEFAULT_PRINTER_PORT;
  }
  if (!host) return null;
  if (!p) p = DEFAULT_PRINTER_PORT;
  return { host, port: p, target: `${host}:${p}` };
}
