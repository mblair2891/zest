import { callout, p, related, steps, tip, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const HR_TOPICS: GuideTopic[] = [
  topic({
    id: "hr-staff-basics",
    chapterId: "roles",
    title: "Clock, time-off, and your file",
    summary:
      "PIN signs you onto a station. Clock in is Labor. Time-off and packets are your employer’s HR if they turned it on.",
    roles: ["server", "kitchen_bar", "vendor_operator", "owner_manager", "host_operator"],
    keywords: ["clock", "time-off", "hr", "employment", "i-9", "schedule", "pin"],
    openView: "labor",
    blocks: [
      why(
        "Your employer (the host house or your operator) keeps employment files separate from the floor PIN.",
      ),
      ul(
        "PIN on this station is not a time punch. Enter opens the floor. Clock in on the pad only punches and does not open order entry. Clock out is Close out at the end of the shift.",
        "If your employer enabled time-off, request it on HR. A manager approves or denies.",
        "Availability windows (if enabled) are your usual days. The published schedule is still Labor.",
        "Onboarding packets (W-4, I-9, state forms) arrive by email or as a download to sign. Return the signed PDF if the house is not using an e-sign vendor. I-9 copies are stored by section.",
        "You belong to one employer entity. Another stall cannot open your file.",
      ),
      steps(
        "On the PIN pad, enter your PIN and tap Clock in to punch, or Enter to open the station. There is no Clock out key. If you Enter while off the clock and inside today’s window, you may accept Clock in for this shift? or tap Not now. Already clocked in, Enter goes to work and the floor shows clocked in HH:MM.",
        "Open HR only if your house uses it — request time-off or confirm availability.",
        "Complete packets you were sent. Do not skip I-9 sections or backdate them.",
      ),
      warn(
        "Do not text a full Social Security number to a manager. The house stores last4 and encrypted tax fields only.",
      ),
      related("hr-employment", "payroll-export", "location-training", "role-server"),
    ],
  }),
  topic({
    id: "payroll-export",
    chapterId: "roles",
    title: "Hours export — not a payroll processor",
    summary:
      "Summex does not process payroll; it feeds ADP, Intuit, or a CSV/PDF with hours, OT flags, and tips.",
    roles: ["owner_manager", "host_operator", "vendor_operator", "server", "kitchen_bar"],
    keywords: ["payroll", "adp", "intuit", "quickbooks", "csv", "hours", "overtime", "tips", "export"],
    openView: "reports",
    blocks: [
      why(
        "The house already has a payroll product. Summex records time, jobs, OT flags, and tips, then hands a file to that product.",
      ),
      ul(
        "Reports → Payroll export (and Labor → Hours export) is entity-scoped: employees, role, entity, regular vs OT hours, OT flags (daily / weekly / seventh-day from owner-entered venue rules), declared and card tips, pay period. Card tips already cashed out at closeout are omitted from the file.",
        "Formats: generic CSV and a hours PDF always. Intuit QuickBooks Payroll and ADP when keys are set. Other payroll products import the same CSV. The PDF is not a paycheck.",
        "HR → Flags: destination None, CSV only, Intuit, ADP, or Other. Map local staff to the provider employee id — never a Social Security number.",
        "Direct API uses INTUIT_* or ADP_* on the server. Missing keys show Connect and still download CSV.",
        "Host and tenant isolation: you export only that employer’s staff unless hours visibility allows the host.",
      ),
      steps(
        "Pick the pay period. Review hours, OT, declared tips, and CC tips.",
        "Download CSV or PDF (always). If Intuit or ADP keys exist, Send hours to provider.",
        "Import the file in ADP, QuickBooks Payroll, or your other processor. They run payroll and file taxes.",
      ),
      warn(
        "Summex does not print checks, e-file taxes, calculate net pay, or move money. Wage rates in HR visibility are not a pay run.",
      ),
      related("ops-jobs", "shift-allowables", "entity-schedule-payroll", "hr-employment", "role-owner", "server-closeout", "tip-pooling"),
    ],
  }),
  topic({
    id: "shift-allowables",
    chapterId: "roles",
    title: "Clock windows, approval, pay periods",
    summary:
      "Published shifts, PIN-pad clock, grace windows, shift approval, and when the hours file is ready. We do not run payroll.",
    roles: ["owner_manager", "host_operator", "vendor_operator", "server", "kitchen_bar"],
    keywords: ["clock", "allowable", "approval", "pay period", "override", "red flag", "schedule", "PIN"],
    openView: "labor",
    blocks: [
      why(
        "Each selling entity schedules its own staff. The floor clock must match that entity’s published week. Exceptions are blocked or flagged — managers override with PIN. Hours leave the house as an export, not a paycheck.",
      ),
      ul(
        "Ownership: kitchen cannot publish bar shifts and vice versa. Shared employees are assigned to one entity per shift (home entity, or an explicit extra-entity grant).",
        "Schedule grid: week or pay period. Role, entity, optional station or section, start, end, break. Copy last week. Publish week. Unpublished drafts do not appear on the clock.",
        "Clock in is its own key on the station PIN pad — separate from Enter. Completing clock in does not open order entry. Clock out is the last step of Close out.",
        "Grace (minutes): early clock-in, late clock-in, early clock-out, late clock-out. Outside grace: allow with manager PIN, or block (setting).",
        "Clock only on a published shift (default on). No scheduled shift is a red flag when that setting is on.",
        "Approval per entity: (1) manual — manager approves every punch; (2) auto if clock-out is within X minutes of scheduled end; (3) auto if clock-out is within X minutes of that employee’s last closed ticket. Unapproved punches stay in Exceptions. Approved punches lock for export.",
        "Red-flag notify managers: early in, late in, early out, late out, missed punch, no scheduled shift.",
        "Pay period weekly / biweekly / semimonthly with period-end time in the venue timezone. Payroll packet ready N days before pay date.",
        "Provider connected: send automatic / after review / manual. Not connected: download CSV or PDF (hours by employee, role, entity, regular vs OT flags). Email the owner that the packet is ready.",
        "OT / wage rules (owner-entered): optional daily OT, weekly OT, seventh-day optional. Used only for export columns and red flags — not a legal determination.",
      ),
      steps(
        "Labor → Schedule. Add shifts for this entity. Copy last week if the grid repeats. Publish week — drafts stay off the clock.",
        "Labor → Rules. Set grace windows, block vs manager PIN, approval mode, pay period and period-end time, OT flags, packet-ready days.",
        "Staff: PIN pad → Clock in (punch only) or Enter (open the station). Clock out is Close out. Manager PIN overrides outside grace when the house allows it.",
        "Supervisor: Exceptions hold unapproved punches. Approve to lock for export.",
        "Labor → Hours export: when the period ends, Download CSV/PDF or Send. Summex does not print a paycheck.",
      ),
      warn(
        "Summex does not calculate net pay, file taxes, or move money. OT flags are the house’s entered rules, not a legal determination.",
      ),
      related("payroll-export", "entity-schedule-payroll", "hr-staff-basics"),
    ],
  }),
  topic({
    id: "hr-employment",
    chapterId: "roles",
    title: "HR & employment (entity)",
    summary:
      "Host or tenant can be the employer. Every HR module is optional. Packets follow employment state. Visibility is a dropdown per field.",
    roles: ["owner_manager", "host_operator", "vendor_operator"],
    keywords: [
      "hr",
      "employment",
      "applicants",
      "onboarding",
      "e-sign",
      "docusign",
      "hellosign",
      "w-4",
      "i-9",
      "payroll",
      "write-up",
      "visibility",
    ],
    visibility: "signed",
    openView: "hr",
    blocks: [
      why(
        "The employer of record is the entity that turns HR on — the host, or a tenant operator. Staff files stay on that entity.",
      ),
      ul(
        "Flags (all default off except scheduling and time clock, which stay on Labor): applicants, onboarding packets, e-sign, scheduling, time-off, time clock, hours export (CSV/ADP/Intuit), hours & tips summary, write-ups, availability, minor/alcohol eligibility.",
        "Visibility per field: hours, wages, documents, write-ups. Options: entity owner, entity owner + managers, host (if this is a tenant), or hidden from others.",
        "Host sees a tenant’s HR only when that tenant’s visibility allows Host. Cross-entity files are denied.",
        "Employment state (or Federal only) drives W-4 plus that state’s withholding / new-hire packet list.",
      ),
      steps(
        "Settings or HR → Flags. Enable HR for this employer. Pick the US state.",
        "Turn on only the modules you will use. Save.",
        "Hiring: add applicants and move stages (applied → hired).",
        "Onboarding: start a checklist. Date I-9 Section 1 before Section 2. Store last4; full SSN encrypts when a PII secret is set.",
        "Packets: send to the employee email. If e-sign is configured, the vendor sends. If not, status is awaiting upload — attach the signed PDF (stored on the packet).",
        "Employer counter-sign when the form requires it (I-9 Section 2).",
      ),
      callout(
        "E-sign",
        "With DocuSign or HelloSign keys, the UI says e-sign and sends an envelope. Without keys, the packet is still generated and emailed; managers attach the completed PDF. Failed vendor calls fall back to the same outbox.",
      ),
      warn(
        "I-9 is a status + date + file store. Do not skip sections, backdate, or tell the employee which documents to present. This is not a tax engine.",
      ),
      tip(
        "Hours export feeds ADP, Intuit, or CSV. Summex does not process payroll. Availability is weekday windows; published shifts stay on Labor.",
      ),
      related("hr-staff-basics", "hr-platform-flags", "role-owner"),
    ],
  }),
  topic({
    id: "hr-platform-flags",
    chapterId: "platform",
    title: "HR flags (platform)",
    summary:
      "Employment modules are per entity. Platform support does not see SSN or full tax packets.",
    visibility: "platform",
    roles: ["platform_admin"],
    keywords: ["hr", "employment", "flags", "ssn", "pii", "redact", "entity"],
    blocks: [
      why(
        "Platform Admin may confirm that an employer turned a flag on. Employment PII is not a support surface.",
      ),
      ul(
        "Flags live on the location setup, keyed by employer entity (host or operator id). There is no global HR kill switch in Platform Settings beyond what the entity saved.",
        "Support view redacts SSN, tax ciphertext, and write-up bodies. Wages and document packets are hidden from platform_admin by default.",
        "Factory reset wipes hr_applicants, hr_onboarding, hr_packets, hr_time_off, hr_writeups, hr_availability, hr_eligibility, hr_tax_pii, and hr_payroll_map.",
      ),
      warn("Do not ask a house to paste a full SSN into a ticket. Last4 is the support identifier."),
      related("platform-settings", "factory-reset", "hr-employment"),
    ],
  }),
];
