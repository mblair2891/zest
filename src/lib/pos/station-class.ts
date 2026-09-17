/** Handheld vs terminal: card on the floor, cash/kick only at the drawer. Leaf, no @/. */

export type StationClass = "handheld" | "terminal";
export type CardReaderKind = "mobile" | "counter";

export const STATION_CLASSES: StationClass[] = ["handheld", "terminal"];
export const CARD_READER_KINDS: CardReaderKind[] = ["mobile", "counter"];

export const STATION_CLASS_LABEL: Record<StationClass, string> = {
  handheld: "Handheld (card, no drawer)",
  terminal: "Terminal (cash + drawer)",
};

export const CARD_READER_KIND_LABEL: Record<CardReaderKind, string> = {
  mobile: "Mobile reader",
  counter: "Counter reader",
};

export type StationClassDevice = {
  id: string;
  type?: string;
  label?: string;
  status?: string;
  assignment?: { function?: string };
  stationClass?: string | null;
  cardReaderId?: string | null;
  cardReaderKind?: string | null;
  receiptPrinterId?: string | null;
};

export function parseStationClass(
  raw: unknown,
  device?: StationClassDevice | null,
): StationClass {
  if (raw === "handheld" || raw === "terminal") return raw;
  const fn = device?.assignment?.function;
  const type = device?.type;
  if (type === "host_stand" || fn === "host_stand" || fn === "cashier") return "terminal";
  return "handheld";
}

export function parseCardReaderKind(raw: unknown, stationClass?: StationClass): CardReaderKind {
  if (raw === "mobile" || raw === "counter") return raw;
  return stationClass === "terminal" ? "counter" : "mobile";
}

export function isOrderOrHostStation(d: StationClassDevice | null | undefined): boolean {
  if (!d) return false;
  const fn = d.assignment?.function;
  if (fn === "kitchen_kds" || fn === "bar_kds" || fn === "expo" || fn === "split" || fn === "kiosk") {
    return false;
  }
  if (d.type === "kds" || d.type === "kiosk") return false;
  return true;
}
