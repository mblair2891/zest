import type { LocationMode } from "@/lib/pos/saas-types";
import { VENUE_TYPES } from "./types";
import type {
  IntakeAnswers,
  OnboardingPayload,
  StationType,
} from "./prospect-types";

export function payloadFromAnswers(answers: IntakeAnswers): OnboardingPayload {
  const typeEntries = Object.entries(answers.portfolio.typeCounts).filter(
    ([, n]) => (n ?? 0) > 0,
  );
  const locations: OnboardingPayload["locations"] = [];
  if (typeEntries.length === 0) {
    locations.push(emptyLocationDraft(answers, "restaurant", 0));
  } else {
    let i = 0;
    for (const [type, count] of typeEntries) {
      const n = Math.max(1, count ?? 1);
      for (let k = 0; k < n; k += 1) {
        const venue = (VENUE_TYPES as readonly string[]).includes(type)
          ? (type as LocationMode)
          : "restaurant";
        locations.push(emptyLocationDraft(answers, venue, i));
        i += 1;
      }
    }
  }
  const period =
    answers.payments.payoutFrequency === "daily" ||
    answers.payments.payoutFrequency === "biweekly"
      ? answers.payments.payoutFrequency
      : "weekly";
  return {
    org: {
      ...answers.company,
      ownerContactName: "",
      billingContactName: "",
      opsContactName: "",
      opsContactEmail: answers.company.billingEmail,
      currency: "USD",
    },
    locations,
    invites: [],
    settlement: {
      periodType: period,
      hostCutPercent: answers.operating.guestPaysHostCheck ? 10 : 0,
    },
    checklist: { trainingAck: false, hardwareAck: false, paymentsAck: false },
    partnerHardware: {
      shipToName: answers.company.legalName || answers.company.dba || "",
      shipToAddress: answers.company.hqAddress || "",
      shipToPhone: answers.company.phone || "",
      items: partnerHardwareItemsFromAnswers(answers),
      note: "Partner hardware ships from the payments partner to this address. Summex does not take possession.",
    },
  };
}

function partnerHardwareItemsFromAnswers(answers: IntakeAnswers): OnboardingPayload["partnerHardware"]["items"] {
  const hw = answers.hardware;
  if (!hw) return [];
  const items: OnboardingPayload["partnerHardware"]["items"] = [];
  if (hw.shipReaders && hw.readerQty > 0) {
    items.push({
      skuId: hw.readerPay === "lease" ? "finix_reader_lease" : "finix_reader",
      name: "Quantum / Finix card reader",
      qty: hw.readerQty,
      status: "requested",
    });
  }
  if (hw.shipPartnerDevices) {
    for (const [skuId, qty] of Object.entries(hw.partnerSkuQty ?? {})) {
      if ((qty ?? 0) > 0) {
        items.push({ skuId, name: skuId, qty: Number(qty) || 0, status: "requested" });
      }
    }
  }
  return items;
}

function emptyLocationDraft(
  answers: IntakeAnswers,
  venueType: LocationMode,
  index: number,
): OnboardingPayload["locations"][0] {
  const host =
    answers.operating.model === "host_operators" ||
    venueType === "food_hall" ||
    venueType === "truck_pod";
  const opCount = host ? Math.max(2, answers.operating.operatorsPerLocation) : 0;
  const brand = answers.company.dba || answers.company.legalName || "Location";
  return {
    clientId: `draft_${index}`,
    name: index === 0 ? brand : `${brand} ${index + 1}`,
    address: answers.company.hqAddress,
    timezone: "America/Los_Angeles",
    venueType,
    hostBrandName: brand,
    operatingModel: host ? "host_operators" : "single",
    operators: Array.from({ length: opCount }, (_, n) => ({
      legalName: "",
      dba: `Operator ${n + 1}`,
      contactEmail: "",
      contactPhone: "",
      stationTypes: ["both"] as StationType[],
      payoutBankLast4: "",
      payoutRoutingToken: "",
    })),
    tableCount: 0,
    sectionNames: "",
    floorLater: true,
    menuMode: "empty",
    devices: {
      pos: answers.volume.peakDevices,
      kds: answers.modules.kds ? 2 : 0,
      handhelds: 0,
    },
  };
}
