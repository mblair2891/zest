import { PACKAGE_BY_ID, type PackageId } from "@/lib/pos/packages";
import type { LocationMode } from "@/lib/pos/saas-types";
import { uid } from "@/lib/utils";
import type {
  IntakeAnswers,
  PricingRules,
  QuoteLine,
  QuoteSnapshot,
} from "./prospect-types";

export const DEFAULT_PRICING_RULES: PricingRules = {
  version: "2026-08-v1",
  locationMonthlyCents: {
    restaurant: 19900,
    bar_lounge: 14900,
    cafe: 12900,
    qsr: 14900,
    food_hall: 39900,
    truck_pod: 34900,
    ghost_kitchen: 24900,
    catering: 17900,
  },
  operatorMonthlyCents: 4900,
  includedSeats: 10,
  seatPackSize: 10,
  seatPackCents: 2900,
  includedDevices: 3,
  devicePackSize: 5,
  devicePackCents: 1900,
  onboardingFeeCents: 150000,
  annualDiscount: 0.1,
};

const CHANNEL_PACKAGES: { key: keyof IntakeAnswers["channels"]; packageId: PackageId }[] = [
  { key: "floor", packageId: "host_stand" },
  { key: "kiosk", packageId: "online_kiosk" },
  { key: "online", packageId: "online_kiosk" },
  { key: "inventory", packageId: "inventory" },
  { key: "labor", packageId: "labor" },
  { key: "giftCards", packageId: "guests_crm" },
  { key: "crm", packageId: "guests_crm" },
  { key: "marketing", packageId: "marketing_suite" },
  { key: "vendorPortal", packageId: "vendor_portal" },
  { key: "multiLocationReporting", packageId: "advanced_ops" },
];

function line(
  kind: QuoteLine["kind"],
  label: string,
  quantity: number,
  unitCents: number,
  recurring: QuoteLine["recurring"],
  packageId?: PackageId,
): QuoteLine {
  return {
    id: uid("ql"),
    kind,
    label,
    quantity,
    unitCents,
    amountCents: quantity * unitCents,
    packageId,
    recurring,
  };
}

export function locationCount(answers: IntakeAnswers): number {
  const fromTypes = answers.locationTypes.reduce(
    (s, t) => s + Math.max(0, t.count || 0),
    0,
  );
  return Math.max(1, fromTypes || answers.locationsNow || 1);
}

export function buildQuote(
  answers: IntakeAnswers,
  rules: PricingRules = DEFAULT_PRICING_RULES,
): QuoteSnapshot {
  const lines: QuoteLine[] = [];
  const packageIds = new Set<PackageId>(["pos_core", "kds", "reports_cash", "menu_admin"]);
  const locN = locationCount(answers);

  const types =
    answers.locationTypes.filter((t) => t.count > 0).length > 0
      ? answers.locationTypes.filter((t) => t.count > 0)
      : [{ mode: "restaurant" as LocationMode, count: locN }];

  for (const t of types) {
    const unit = rules.locationMonthlyCents[t.mode] ?? rules.locationMonthlyCents.restaurant;
    const label =
      t.mode === "food_hall"
        ? "Food hall / host location"
        : t.mode.replace("_", " ");
    lines.push(
      line("location", `${label} software`, t.count, unit, "monthly"),
    );
  }

  const host =
    answers.operatingModel === "host_multi_operator" ||
    types.some((t) => t.mode === "food_hall" || t.mode === "truck_pod");
  if (host) {
    packageIds.add("hall_settlement");
    packageIds.add("vendor_portal");
    const ops = Math.max(1, answers.operatorsPerLocation) * locN;
    lines.push(
      line(
        "operator",
        "Operator / merchant seats",
        ops,
        rules.operatorMonthlyCents,
        "monthly",
      ),
    );
  }

  if (answers.channels.kds) packageIds.add("kds");

  for (const map of CHANNEL_PACKAGES) {
    if (!answers.channels[map.key]) continue;
    packageIds.add(map.packageId);
  }

  for (const id of packageIds) {
    const pkg = PACKAGE_BY_ID[id];
    if (!pkg || pkg.priceMonthly <= 0 || pkg.required) continue;
    lines.push(
      line(
        "module",
        `${pkg.shortName} × ${locN} location${locN === 1 ? "" : "s"}`,
        locN,
        pkg.priceMonthly * 100,
        "monthly",
        id,
      ),
    );
  }

  const extraSeats = Math.max(0, answers.staffSeats - rules.includedSeats);
  if (extraSeats > 0) {
    const packs = Math.ceil(extraSeats / rules.seatPackSize);
    lines.push(
      line(
        "seats",
        `Extra staff seats (${rules.seatPackSize}/pack)`,
        packs,
        rules.seatPackCents,
        "monthly",
      ),
    );
  }

  const extraDev = Math.max(0, answers.peakDevices - rules.includedDevices);
  if (extraDev > 0) {
    const packs = Math.ceil(extraDev / rules.devicePackSize);
    lines.push(
      line(
        "devices",
        `Extra devices (${rules.devicePackSize}/pack)`,
        packs,
        rules.devicePackCents,
        "monthly",
      ),
    );
  }

  if (rules.onboardingFeeCents > 0) {
    lines.push(
      line(
        "onboarding",
        "One-time onboarding",
        1,
        rules.onboardingFeeCents,
        "one_time",
      ),
    );
  }

  const monthlyCents = lines
    .filter((l) => l.recurring === "monthly")
    .reduce((s, l) => s + l.amountCents, 0);
  const oneTimeCents = lines
    .filter((l) => l.recurring === "one_time")
    .reduce((s, l) => s + l.amountCents, 0);
  const annualCents = Math.round(monthlyCents * 12 * (1 - rules.annualDiscount));

  const assumptions = [
    `${locN} location${locN === 1 ? "" : "s"} billed monthly.`,
    host
      ? `Host + operators: guest pays once under the host brand via Zest Payments. ~${answers.operatorsPerLocation} operators/location.`
      : "Single-operator locations.",
    `Seats ${answers.staffSeats} (first ${rules.includedSeats} included). Peak devices ${answers.peakDevices} (first ${rules.includedDevices} included).`,
    `GMV band ${answers.gmvBand.replace(/_/g, " ")}; ~${answers.monthlyChecks} checks/month (volume is not a surcharge in v1).`,
    "Card processing is Zest Payments only. Operator payout frequency is informational for settlement setup.",
    rules.annualDiscount > 0
      ? `Annual prepay saves ${Math.round(rules.annualDiscount * 100)}%.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    issuedAt: Date.now(),
    currency: "USD",
    lines,
    monthlyCents,
    annualCents,
    oneTimeCents,
    assumptions,
    packageIds: [...packageIds],
    rulesVersion: rules.version,
  };
}
