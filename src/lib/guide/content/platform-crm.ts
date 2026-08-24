import { callout, p, related, steps, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const PLATFORM_CRM_TOPICS: GuideTopic[] = [
  topic({
    id: "platform-crm",
    chapterId: "platform",
    title: "CRM (accounts, contacts, deals)",
    summary: "Leads, accounts, opportunities, and a timeline — not POS guest CRM.",
    visibility: "platform",
    roles: ["platform_admin"],
    keywords: ["crm", "lead", "account", "contact", "deal", "opportunity", "activity"],
    blocks: [
      why(
        "Sales and success need a house record before there is a tenant. CRM lives on the control plane. Guest loyalty is a different product.",
      ),
      ul(
        "Accounts are companies. Stage follows Lead → Qualified → Proposal → Contract → Onboarding → Live → Churned.",
        "Contacts are people on an account (email, phone, role).",
        "Opportunities carry monthly amount, plan, probability, and close date.",
        "Activities are notes, calls, emails, tasks, and stage changes. Tasks have due dates.",
        "Get pricing / intake creates a prospect that syncs into CRM automatically.",
      ),
      steps(
        "Platform → CRM. Add lead, or wait for intake to appear.",
        "Log a follow-up with a due date. Open the account timeline.",
        "Start onboarding when the deal is ready — that writes a real onboarding run, not a demo seed.",
        "Go live only after org, location, and owner invite exist. The org then shows under Tenants.",
      ),
      warn("CRM never seeds The Laundry or PIN 0000 rooms. Locations come from onboarding only."),
      related("saas-lifecycle", "platform-tenants", "prospect-intake"),
    ],
  }),
  topic({
    id: "saas-lifecycle",
    chapterId: "platform",
    title: "Pipeline & lifecycle",
    summary: "Lead through live, wired to quotes, contract, and onboarding.",
    visibility: "platform",
    roles: ["platform_admin"],
    keywords: ["pipeline", "kanban", "quote", "contract", "go live", "churn"],
    blocks: [
      why(
        "The subscriber lifecycle is one path. A quoted house is not a tenant until onboarding creates an org.",
      ),
      p(
        "Pipeline board columns match prospect status: prospect, quoted, accepted, contracted, onboarding, live, rejected, churned. List view is the same data.",
      ),
      steps(
        "Intake snapshots a quote. Status becomes quoted.",
        "Merchant accepts. Admin marks contract signed — that starts the onboarding checklist.",
        "Or from CRM: Start onboarding on the account (same machine).",
        "Complete org, locations, operators, invites. Go live promotes the org to Tenants.",
      ),
      callout("Go live", "Requires a real org and location. Never a demo seed."),
      related("platform-crm", "onboarding-wizard", "quote-contract"),
    ],
  }),
  topic({
    id: "platform-tenants",
    chapterId: "platform",
    title: "Tenant directory",
    summary: "Live orgs, locations, operators, plan, health. Suspend with confirm.",
    visibility: "platform",
    roles: ["platform_admin"],
    keywords: ["tenant", "org", "suspend", "mrr", "directory"],
    blocks: [
      why("Once a house is live it is a tenant — billed software, not a prospect card."),
      ul(
        "Directory shows plan, location count, operators, MRR proxy from the deal, past-due, open tickets.",
        "Drill-in lists locations, operators, and users.",
        "Suspend requires confirm. Reactivate restores access. Nothing is silently deleted.",
      ),
      related("saas-billing", "saas-support", "empty-start"),
    ],
  }),
  topic({
    id: "saas-billing",
    chapterId: "platform",
    title: "Software billing",
    summary: "Plans, invoices, Stripe or sandbox — not Quantum Payments.",
    visibility: "platform",
    roles: ["platform_admin"],
    keywords: ["stripe", "invoice", "mrr", "subscription", "saas fee"],
    blocks: [
      why(
        "Software subscription is a different rail from guest cards. Mixing them is how houses get confused at close.",
      ),
      ul(
        "Plans and entitlements (locations, seats) live on org_subscriptions.",
        "Without STRIPE_SECRET_KEY the console is sandbox: assign a plan and issue invoices by hand.",
        "Failed invoices surface on Billing and Reports. They do not stop cash on the floor.",
      ),
      related("platform-tenants", "quote-contract"),
    ],
  }),
  topic({
    id: "saas-support",
    chapterId: "platform",
    title: "Support & success",
    summary: "Tickets linked to accounts, macros, health signals.",
    visibility: "platform",
    roles: ["platform_admin"],
    keywords: ["ticket", "support", "macro", "csm", "health"],
    blocks: [
      why("Success needs a thread on the account, not a private inbox."),
      steps(
        "Open Support. New ticket, optional account link, first comment.",
        "Use macros for go-live, network, billing vs cards, PIN vs password.",
        "Health on Tenants and Reports: open tickets, past due, failed invoices.",
      ),
      related("platform-crm", "saas-billing", "network-readiness"),
    ],
  }),
  topic({
    id: "saas-reporting",
    chapterId: "platform",
    title: "SaaS reporting",
    summary: "Funnel, pipeline value, live locations, churn — real rows only.",
    visibility: "platform",
    roles: ["platform_admin"],
    keywords: ["funnel", "pipeline value", "churn", "reports"],
    blocks: [
      why("Admin metrics are for the book of business, not a POS daypart."),
      ul(
        "Funnel counts CRM accounts by stage.",
        "Pipeline value sums opportunity monthly amounts.",
        "Live orgs and locations exclude is_demo leftovers (there should be none).",
      ),
      related("platform-crm", "saas-lifecycle", "platform-tenants"),
    ],
  }),
];
