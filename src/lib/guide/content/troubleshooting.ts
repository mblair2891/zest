import { callout, p, related, steps, tip, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const TROUBLESHOOTING_TOPICS: GuideTopic[] = [
  topic({
    id: "troubleshooting",
    chapterId: "troubleshooting",
    title: "Common errors & who to contact",
    summary: "Fast checks before you page a manager or platform support.",
    roles: "all",
    keywords: ["error", "support", "faq", "contact", "troubleshoot", "help"],
    blocks: [
      why(
        "Most “the system is down” moments are a role filter, a fire rule, or a dead ISP with a live house Wi‑Fi. Check those before you escalate.",
      ),
      ul(
        "Can’t see a menu item? Wrong PIN access level or package preview is filtering it.",
        "Kitchen never got an ahead order? Fire mode is on_arrival — guest must check in or staff must mark arrived / fire now.",
        "Internet died? House Wi‑Fi still runs the floor. Tap the Wi‑Fi chip — card captures queue until the ISP is back.",
        "Card pay queued? That is Quantum Payments waiting on uplink, not a second processor “failing.”",
        "Can’t seat a table? Section lock. Ask a manager for a grant.",
        "Empty POS, no menu? You are on a live empty start. Add items or finish onboarding.",
        "Forced password screen? Platform Admin must set a new password once. It cannot be the initial password.",
        "What’s New every login? Check Silence until the next update. It returns when a newer matching entry ships. Replay workflow from Guide is separate.",
      ),
      steps(
        "Reproduce once. Note the screen, the PIN role, and whether the Wi‑Fi chip shows an outage.",
        "Ask the floor manager. Comps, grants, and voids are their PIN.",
        "Org-level issues (invites, packages, missing location): owner on the platform.",
        "Tenant / prospect / Admin bootstrap: Platform Admin, then support@summex.app.",
        "Card disputes: Settle → File dispute (see Chargebacks). Do not email a different processor.",
      ),
      callout(
        "Who to contact",
        "Server → Manager → Owner → Platform Admin → support@summex.app. Quantum Payments disputes stay in Settlement.",
      ),
      related("wifi-offline", "chargebacks", "login", "whats-new-on-login", "role-walkthroughs", "audit", "using-guide"),
    ],
  }),
  topic({
    id: "audit",
    chapterId: "troubleshooting",
    title: "Audit basics",
    summary: "What the product already records and what not to paper over.",
    roles: ["owner_manager", "platform_admin", "host_operator"],
    keywords: ["audit", "void", "comp", "dispute", "log", "history"],
    blocks: [
      why(
        "Voids, comps, period closes, and dispute filings are how money moves without a new tender. If you rewrite them out of band, settlement will not match the drawer.",
      ),
      ul(
        "Checks keep line history, tenders, tips, and operator tags.",
        "Comps/voids may require a manager PIN — that is the audit trail.",
        "Settlement periods are immutable once closed; a new period is the correction path.",
        "Chargeback filings record the $35 split. Won/lost does not erase the fee.",
        "Prospect pipeline events (quoted, accepted, contracted) are the SaaS audit for onboarding.",
      ),
      steps(
        "Do not void a closed check to hide a dispute — file it on Settle.",
        "Do not reopen a closed period. Adjust in the next period or with a manager note.",
        "Export / screenshot a period if a stall operator questions a payout. The ledger is the answer.",
      ),
      warn(
        "Platform Admin can see tenants; that is not a reason to impersonate a PIN on the floor. Support should ask the owner to reproduce.",
      ),
      related("checks-comps", "chargebacks", "settlement", "platform-admin"),
    ],
  }),
  topic({
    id: "glossary",
    chapterId: "troubleshooting",
    title: "Glossary",
    summary: "Words this product uses in a specific way.",
    roles: "all",
    keywords: ["glossary", "terms", "definition", "host", "operator", "mid"],
    blocks: [
      why(
        "Host, operator, and host stand mean three different jobs. Mixing them up is how multi-operator sites get wired as three restaurants.",
      ),
      steps(
        "When a word in this product confuses you, search it in the guide (try “host capture” or “chargeback”).",
        "If two jobs share a word (host stand vs Host Venue), read both topics before you change operating model.",
      ),
      ul(
        "Check / order — guest bill; may include several operators’ lines.",
        "Ticket — kitchen/bar fire group from a check.",
        "Host Venue — the guest-facing hall/pod brand and card MID owner.",
        "Operator A / Operator B — stall or kitchen brands on a host floor. Not card processors.",
        "Host stand — FOH waitlist/seating role (PIN: Host).",
        "Host capture — one Quantum Payments charge on the host MID.",
        "Package — licensed module bundle on a location.",
        "PIN access level — which POS tools a station user may open.",
        "House hub — station that holds live checks; satellites reach it over Wi‑Fi.",
        "Staff SSID — isolated Wi‑Fi for POS, KDS, printers, readers. Not guest.",
        "Outbox — cloud queue for card captures and messages while the ISP is down.",
        "Period — settlement window; close it to mint operator payouts.",
        "Chargeback fee — $35 on file, split by merchandise %; not reversed on won/lost.",
      ),
      related("intro", "single-vs-multi", "host-capture", "chargebacks"),
    ],
  }),
];
