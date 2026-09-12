/**
 * Billing-owner venue onboarding (peer + single-operator).
 * Nine gated steps. No Finix form and no menu on the venue.
 */
import {
  minEntityCount,
  operatingModelFromVenueKind,
  parseCashRoundIncrement,
  parseVenueQrMode,
  parseVenueServiceStyle,
  parseVenueTaxMode,
  type CashRoundIncrement,
  type VenueKind,
  type VenueQrMode,
  type VenueServiceStyle,
  type VenueTaxMode,
} from "./venue-entity";
import type { OnboardingLocationDraft, OnboardingPayload, OperatorDraft } from "./prospect-types";

export const VENUE_OWNER_STEP_IDS = [
  "building",
  "model",
  "entity_count",
  "service",
  "cash",
  "qr",
  "tax",
  "entity_slots",
  "devices_plan",
] as const;
export type VenueOwnerStepId = (typeof VENUE_OWNER_STEP_IDS)[number];

export const VENUE_OWNER_STEP_LABEL: Record<VenueOwnerStepId, string> = {
  building: "Building",
  model: "Model",
  entity_count: "Entities",
  service: "Service",
  cash: "Cash rounding",
  qr: "QR",
  tax: "Tax",
  entity_slots: "Operators",
  devices_plan: "Devices",
};

export const VENUE_OWNER_STEPS = VENUE_OWNER_STEP_IDS.map((id) => VENUE_OWNER_STEP_LABEL[id]);

export function isVenueOwnerStepId(raw: string): raw is VenueOwnerStepId {
  return (VENUE_OWNER_STEP_IDS as readonly string[]).includes(raw);
}

export type VenueWizardFields = {
  serviceStyle: VenueServiceStyle;
  cashRoundIncrement: CashRoundIncrement;
  qrMode: VenueQrMode;
  taxMode: VenueTaxMode;
  kioskCount: number;
  hostCount: number;
};

export function emptyOperatorSlot(_n?: number): OperatorDraft {
  return {
    legalName: "",
    dba: "",
    contactEmail: "",
    contactPhone: "",
    stationTypes: ["both"],
    payoutBankLast4: "",
    payoutRoutingToken: "",
  };
}

export function padOperatorSlots(ops: OperatorDraft[], count: number): OperatorDraft[] {
  const n = Math.max(1, Math.min(40, Math.round(count) || 1));
  const next = ops.slice(0, n).map((o) => ({ ...o }));
  while (next.length < n) next.push(emptyOperatorSlot(next.length + 1));
  return next;
}

export function venueKindFromLocation(loc: OnboardingLocationDraft | undefined): VenueKind {
  if (!loc) return "single_operator";
  if (loc.operatingModel === "peer_venue") return "peer";
  if (loc.operatingModel === "host_operators") return "hosted";
  return "single_operator";
}

export function applyVenueKind(
  payload: OnboardingPayload,
  kind: VenueKind,
): OnboardingPayload {
  const locations = payload.locations.map((l) => {
    const min = minEntityCount(kind);
    const ops =
      kind === "hosted"
        ? padOperatorSlots(l.operators, Math.max(min, l.operators.length || 1))
        : padOperatorSlots(l.operators.length ? l.operators : [], min);
    return {
      ...l,
      operatingModel: operatingModelFromVenueKind(kind),
      operators: kind === "single_operator" ? padOperatorSlots(ops, 1) : ops,
    };
  });
  return { ...payload, locations };
}

export function setEntityCount(payload: OnboardingPayload, count: number): OnboardingPayload {
  const kind = venueKindFromLocation(payload.locations[0]);
  const n = Math.max(minEntityCount(kind), Math.min(40, Math.round(count) || minEntityCount(kind)));
  return {
    ...payload,
    locations: payload.locations.map((l) => ({
      ...l,
      operators: padOperatorSlots(l.operators, n),
    })),
  };
}

export function readVenueWizardFields(loc: OnboardingLocationDraft | undefined): VenueWizardFields {
  const extra = loc as OnboardingLocationDraft & Partial<VenueWizardFields>;
  return {
    serviceStyle: parseVenueServiceStyle(extra.serviceStyle),
    cashRoundIncrement: parseCashRoundIncrement(extra.cashRoundIncrement),
    qrMode: parseVenueQrMode(extra.qrMode),
    taxMode: parseVenueTaxMode(extra.taxMode),
    kioskCount: Math.max(0, Math.round(Number(extra.kioskCount) || 0)),
    hostCount: Math.max(0, Math.round(Number(extra.hostCount) || 0)),
  };
}

export function patchVenueWizardFields(
  payload: OnboardingPayload,
  patch: Partial<VenueWizardFields>,
): OnboardingPayload {
  return {
    ...payload,
    locations: payload.locations.map((l, i) => {
      if (i !== 0) return l;
      return { ...l, ...readVenueWizardFields(l), ...patch };
    }),
  };
}

export function venueWizardStepComplete(
  step: VenueOwnerStepId,
  payload: OnboardingPayload,
): { ok: boolean; error?: string } {
  const loc = payload.locations[0];
  if (!loc) return { ok: false, error: "Add the building first" };
  const kind = venueKindFromLocation(loc);
  const fields = readVenueWizardFields(loc);
  switch (step) {
    case "building": {
      if (loc.name.trim().length < 2) return { ok: false, error: "Building name is required" };
      if (loc.address.trim().length < 4) return { ok: false, error: "Address is required" };
      if (!loc.timezone.trim()) return { ok: false, error: "Timezone is required" };
      return { ok: true };
    }
    case "model":
      if (kind === "hosted") {
        return { ok: false, error: "Use Host + tenants onboarding for a host merchant" };
      }
      return { ok: true };
    case "entity_count": {
      const n = loc.operators.length;
      if (kind === "peer" && n < 2) return { ok: false, error: "A shared building needs at least two selling entities" };
      if (kind === "single_operator" && n !== 1) {
        return { ok: false, error: "A single-operator shop is venue + one entity" };
      }
      return { ok: true };
    }
    case "service":
      return fields.serviceStyle ? { ok: true } : { ok: false, error: "Pick a service style" };
    case "cash":
      return { ok: true };
    case "qr":
      return { ok: true };
    case "tax":
      return { ok: true };
    case "entity_slots": {
      const named = loc.operators.filter((o) => o.dba.trim() || o.legalName.trim());
      if (named.length < minEntityCount(kind)) {
        return { ok: false, error: "Name each selling entity (DBA)" };
      }
      const missingPoc = loc.operators.find(
        (o) => (o.dba.trim() || o.legalName.trim()) && !o.contactEmail.trim() && !o.contactPhone.trim(),
      );
      if (missingPoc) {
        return { ok: false, error: "Each operator needs a POC email or SMS number" };
      }
      return { ok: true };
    }
    case "devices_plan":
      if ((loc.devices.pos || 0) + (loc.devices.handhelds || 0) < 1) {
        return { ok: false, error: "Plan at least one order tablet" };
      }
      return { ok: true };
    default:
      return { ok: true };
  }
}

export function usesVenueOwnerWizard(operatingModel?: string | null): boolean {
  return operatingModel !== "host_operators";
}
