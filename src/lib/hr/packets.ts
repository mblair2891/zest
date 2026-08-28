/** Federal + state employment packet catalog. Names are form identifiers, not legal advice. */

export type PacketTemplate = {
  id: string;
  state: string;
  title: string;
  federal: boolean;
  requiresCounterSign: boolean;
  description: string;
};

const FEDERAL: PacketTemplate[] = [
  {
    id: "fed_w4",
    state: "US",
    title: "Form W-4 (Employee’s Withholding Certificate)",
    federal: true,
    requiresCounterSign: false,
    description: "Federal income tax withholding. Employee completes; employer retains.",
  },
  {
    id: "fed_i9",
    state: "US",
    title: "Form I-9 (Employment Eligibility Verification)",
    federal: true,
    requiresCounterSign: true,
    description:
      "Section 1: employee by first day of work. Section 2: employer within 3 business days after the employee starts. Do not skip sections or backdate. Store completion dates and copies — this is not a substitute for examining original documents.",
  },
  {
    id: "fed_direct_deposit",
    state: "US",
    title: "Direct deposit authorization",
    federal: true,
    requiresCounterSign: false,
    description: "Optional bank authorization. Not a tax form.",
  },
];

/** State withholding / new-hire packets. No-income-tax states still get a new-hire notice. */
const STATE_EXTRA: Record<string, { title: string; description: string }[]> = {
  AL: [{ title: "Form A-4", description: "Alabama employee withholding." }],
  AK: [{ title: "New hire reporting", description: "Alaska has no state income tax. Report new hires as required." }],
  AZ: [{ title: "Form A-4", description: "Arizona withholding percentage." }],
  AR: [{ title: "Form AR4EC", description: "Arkansas employee withholding." }],
  CA: [
    { title: "Form DE 4", description: "California Employee’s Withholding Allowance Certificate." },
    { title: "Wage Theft Protection Act notice", description: "Required hire notice (Labor Code 2810.5)." },
  ],
  CO: [{ title: "Form DR 0004", description: "Colorado employee withholding." }],
  CT: [{ title: "Form CT-W4", description: "Connecticut employee withholding." }],
  DE: [{ title: "Form W-4 (DE)", description: "Delaware uses a state withholding certificate." }],
  FL: [{ title: "New hire reporting", description: "Florida has no state income tax. Report new hires as required." }],
  GA: [{ title: "Form G-4", description: "Georgia employee withholding." }],
  HI: [{ title: "Form HW-4", description: "Hawaii employee withholding." }],
  ID: [{ title: "Form ID W-4", description: "Idaho employee withholding." }],
  IL: [{ title: "Form IL-W-4", description: "Illinois employee withholding." }],
  IN: [{ title: "Form WH-4", description: "Indiana employee withholding." }],
  IA: [{ title: "Form IA W-4", description: "Iowa employee withholding." }],
  KS: [{ title: "Form K-4", description: "Kansas employee withholding." }],
  KY: [{ title: "Form K-4", description: "Kentucky employee withholding." }],
  LA: [{ title: "Form L-4", description: "Louisiana employee withholding." }],
  ME: [{ title: "Form W-4ME", description: "Maine employee withholding." }],
  MD: [{ title: "Form MW 507", description: "Maryland employee withholding." }],
  MA: [{ title: "Form M-4", description: "Massachusetts employee withholding." }],
  MI: [{ title: "Form MI-W4", description: "Michigan employee withholding." }],
  MN: [{ title: "Form W-4MN", description: "Minnesota employee withholding." }],
  MS: [{ title: "Form 89-350", description: "Mississippi employee withholding." }],
  MO: [{ title: "Form MO W-4", description: "Missouri employee withholding." }],
  MT: [{ title: "Form MW-4", description: "Montana employee withholding." }],
  NE: [{ title: "Form W-4N", description: "Nebraska employee withholding." }],
  NV: [{ title: "New hire reporting", description: "Nevada has no state income tax. Report new hires as required." }],
  NH: [{ title: "New hire reporting", description: "New Hampshire has no wage income tax. Report new hires as required." }],
  NJ: [{ title: "Form NJ-W4", description: "New Jersey employee withholding." }],
  NM: [{ title: "Form W-4 (NM)", description: "New Mexico employee withholding (federal W-4 plus state rules)." }],
  NY: [
    { title: "Form IT-2104", description: "New York employee withholding." },
    { title: "Wage Theft Prevention Act notice", description: "Required hire notice of pay rate and payday." },
  ],
  NC: [{ title: "Form NC-4", description: "North Carolina employee withholding." }],
  ND: [{ title: "Form ND W-4", description: "North Dakota employee withholding." }],
  OH: [{ title: "Form IT-4", description: "Ohio employee withholding." }],
  OK: [{ title: "Form OK-W-4", description: "Oklahoma employee withholding." }],
  OR: [{ title: "Form OR-W-4", description: "Oregon employee withholding." }],
  PA: [{ title: "Residency certification", description: "Pennsylvania local earned income tax certificate." }],
  RI: [{ title: "Form RI W-4", description: "Rhode Island employee withholding." }],
  SC: [{ title: "Form SC W-4", description: "South Carolina employee withholding." }],
  SD: [{ title: "New hire reporting", description: "South Dakota has no state income tax. Report new hires as required." }],
  TN: [{ title: "New hire reporting", description: "Tennessee has no wage income tax. Report new hires as required." }],
  TX: [{ title: "New hire reporting", description: "Texas has no state income tax. Report new hires as required." }],
  UT: [{ title: "Form TC-40", description: "Utah withholding follows federal with state instructions." }],
  VT: [{ title: "Form W-4VT", description: "Vermont employee withholding." }],
  VA: [{ title: "Form VA-4", description: "Virginia employee withholding." }],
  WA: [
    { title: "New hire reporting", description: "Washington has no wage income tax. Report new hires as required." },
    { title: "Paid Family & Medical Leave notice", description: "WA PFML employee notice." },
  ],
  WV: [{ title: "Form IT-104", description: "West Virginia employee withholding." }],
  WI: [{ title: "Form WT-4", description: "Wisconsin employee withholding." }],
  WY: [{ title: "New hire reporting", description: "Wyoming has no state income tax. Report new hires as required." }],
  DC: [{ title: "Form D-4", description: "District of Columbia employee withholding." }],
};

export const US_STATES: { code: string; name: string }[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

export function packetsForState(state: string): PacketTemplate[] {
  const st = state.trim().toUpperCase();
  const extra = STATE_EXTRA[st] ?? [
    { title: `${st} new-hire / withholding packet`, description: "Confirm current state forms with counsel." },
  ];
  const statePackets: PacketTemplate[] = extra.map((e, i) => ({
    id: `st_${st}_${i}`,
    state: st || "US",
    title: e.title,
    federal: false,
    requiresCounterSign: false,
    description: e.description,
  }));
  return [...FEDERAL, ...statePackets];
}

export function packetTemplateById(id: string, state: string): PacketTemplate | undefined {
  return packetsForState(state).find((t) => t.id === id);
}

export function renderPacketBody(opts: {
  template: PacketTemplate;
  employeeName: string;
  employerName: string;
  locationName: string;
  state: string;
}): string {
  return [
    opts.template.title,
    "",
    `Employee: ${opts.employeeName}`,
    `Employer: ${opts.employerName}`,
    `Location: ${opts.locationName}`,
    `Jurisdiction: ${opts.template.federal ? "Federal" : opts.state}`,
    "",
    opts.template.description,
    "",
    opts.template.id === "fed_i9"
      ? "I-9: complete Section 1 by the first day of employment. Employer completes Section 2 within 3 business days after the employee starts, after examining original acceptable documents. Do not specify which documents the employee must present. This packet tracks status and dates only."
      : "Complete the official form. This packet is a tracking wrapper — attach the signed original (or complete via e-sign when configured).",
    opts.template.requiresCounterSign ? "Employer counter-signature is required." : "",
  ]
    .filter(Boolean)
    .join("\n");
}
