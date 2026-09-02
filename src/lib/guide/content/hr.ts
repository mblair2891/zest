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
        "PIN on this station is not a time punch. Clock in and out on Labor.",
        "If your employer enabled time-off, request it on HR. A manager approves or denies.",
        "Availability windows (if enabled) are your usual days. The published schedule is still Labor.",
        "Onboarding packets (W-4, I-9, state forms) arrive by email or as a download to sign. Return the signed PDF if the house is not using an e-sign vendor. I-9 copies are stored by section.",
        "You belong to one employer entity. Another stall cannot open your file.",
      ),
      steps(
        "PIN in. Open Labor to clock. Published shift windows apply unless a manager overrides.",
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
      "Summex does not process payroll; it feeds ADP, Intuit, or a CSV with hours, OT, and tips.",
    roles: ["owner_manager", "host_operator", "vendor_operator", "server", "kitchen_bar"],
    keywords: ["payroll", "adp", "intuit", "quickbooks", "csv", "hours", "overtime", "tips", "export"],
    openView: "reports",
    blocks: [
      why(
        "The house already has a payroll product. Summex records time, jobs, OT flags, and tips, then hands a file to that product.",
      ),
      ul(
        "Reports → Payroll export (and Labor → Hours export) is entity-scoped: employees, regular/OT hours, declared and card tips, net tips, pool in/out, department, job, pay period, work location. Card tips already cashed out at closeout are omitted from the file.",
        "Formats: generic CSV always. Intuit QuickBooks Payroll and ADP when keys are set. Other payroll products import the same CSV.",
        "HR → Flags: destination None, CSV only, Intuit, ADP, or Other. Map local staff to the provider employee id — never a Social Security number.",
        "Direct API uses INTUIT_* or ADP_* on the server. Missing keys show Connect and still download CSV.",
        "Host and tenant isolation: you export only that employer’s staff unless hours visibility allows the host.",
      ),
      steps(
        "Pick the pay period. Review hours, OT, declared tips, and CC tips.",
        "Download CSV (always). If Intuit or ADP keys exist, Send hours to provider.",
        "Import the file in ADP, QuickBooks Payroll, or your other processor. They run payroll and file taxes.",
      ),
      warn(
        "Summex does not print checks, e-file taxes, or calculate net pay. Wage rates in HR visibility are not a pay run.",
      ),
      related("ops-jobs", "shift-allowables", "entity-schedule-payroll", "hr-employment", "role-owner", "server-closeout", "tip-pooling"),
    ],
  }),
  topic({
    id: "shift-allowables",
    chapterId: "roles",
    title: "Clock windows, approval, pay periods",
    summary:
      "Published shifts, clock allowables, shift approval, and when the hours file goes to ADP/Intuit or download+notify. We do not run payroll.",
    roles: ["owner_manager", "host_operator", "vendor_operator", "server", "kitchen_bar"],
    keywords: ["clock", "allowable", "approval", "pay period", "override", "red flag", "schedule"],
    openView: "labor",
    blocks: [
      why(
        "The floor clock must match the published week. Exceptions are either blocked or flagged — managers override. Hours still leave the house as an export, not a paycheck.",
      ),
      ul(
        "Schedule: draft then Publish week for that employer entity.",
        "Clock in/out windows: early and late minutes vs shift start and end. Each window can Block or Allow and red-flag.",
        "No published shift: allow, or require manager override.",
        "Approval: manual, auto if clock-out is within X minutes of shift end, or auto if within X minutes of the employee’s last closed ticket.",
        "Red-flag notifies (each toggle): early/late clock in, early/late clock out.",
        "Optional punch rounding and break deduct. Pay period weekly / biweekly / semimonthly / custom with start and pay date.",
        "Auto hours export on/off. Trigger at a time of day after period end, or N days before pay date. Require all shifts approved (toggle).",
        "Provider connected: send Automatic, Automatic after review, or Manual. No provider: same schedule builds a downloadable file and notifies roles/emails.",
      ),
      steps(
        "Labor → Schedule. Add shifts. Publish week.",
        "Labor → Rules. Set windows, approval, pay period, export timing.",
        "Staff clock on Labor. Manager queue on Supervisor for red flags.",
        "Labor → Hours export or Reports → Payroll export: period status, Download or Send.",
      ),
      warn(
        "Summex exports to payroll providers. It does not run payroll, print checks, or e-file taxes.",
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
