import { useState } from "react";
import { Check, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { usePosStore } from "@/lib/pos/store";

/** Product capability matrix — all listed as included in this full demo build */
const MATRIX: { domain: string; items: string[] }[] = [
  {
    domain: "Front of house",
    items: [
      "Floor plan seating",
      "Drag floor editor",
      "Table merge / unmerge",
      "Table transfer",
      "Color-coded server sections",
      "Extra-table grants (shift / seating)",
      "Waitlist + SMS (Twilio)",
      "Reservations + deposits",
      "Host stand",
      "Bar tabs",
      "Takeout / call-in",
      "QR / online ordering",
      "Kiosk mode",
      "Multi-vendor one check",
      "Course / seat mapping",
      "Allergen notes",
    ],
  },
  {
    domain: "Order & kitchen",
    items: [
      "Modifiers & forced choices",
      "86 board",
      "Send / hold / fire",
      "ODS by station",
      "ODS by vendor stall",
      "Start / Bump / recall",
      "Expo readiness timers",
      "Happy hour pricing",
      "Dayparts & channel prices",
      "Bundles / prix fixe",
      "Bottle service",
      "Wine cellar list",
      "Recipe → prep lists",
    ],
  },
  {
    domain: "Payments",
    items: [
      "Card / cash / gift / house",
      "Split tender",
      "Tip suggestions",
      "Auto-grat",
      "Manager void/comp",
      "Refunds (manager)",
      "Gift cards",
      "Room charge (PMS)",
      "Summex Payments (only processor)",
      "ACH vendor payouts (inside Summex)",
      "Period settlement engine",
      "Host cut rules",
      "Cash distribution report",
      "Tax ownership = host",
    ],
  },
  {
    domain: "Labor & hours export",
    items: [
      "Published shift schedule",
      "Clock-in early/late window",
      "Red-flag window from last closed ticket",
      "Auto-approve vs supervisor review",
      "Daily closeout time",
      "Hours export to ADP / Intuit / CSV (Summex is not a payroll processor)",
      "Server/bartender end-of-shift closeout (not clock-out)",
      "Blind cash count + mix-based tip-out recommendations",
      "Card tips cash-at-close vs hours-export (paycheck)",
      "Optional HR: applicants, onboarding packets, e-sign, time-off, write-ups",
      "Entity-scoped employment files (host or operator as employer)",
    ],
  },
  {
    domain: "AI inventory & bar",
    items: [
      "Recipe → theoretical depletion",
      "Daily/weekly/monthly AI audits",
      "Par & reorder points",
      "Supplier connect + draft PO",
      "Drink AI guest questionnaire",
      "Pair drinks with food on check",
    ],
  },
  {
    domain: "SaaS platform",
    items: [
      "Summex brand identity",
      "Organization & plans",
      "Team memberships",
      "Location modes",
      "Device enrollment",
      "Onboarding checklist",
      "Usage dashboard",
      "Merchant W-9 tracking",
    ],
  },
  {
    domain: "Truck pod",
    items: [
      "Pad / slip map",
      "Assign / clear trucks",
      "Amp capacity board",
      "Today lineup",
      "Lease invoices (rent+power+GMV%)",
      "Rotating schedule seeds",
      "Pod open/close",
      "Merchant permits",
    ],
  },
  {
    domain: "Multi-tenant hall",
    items: [
      "Building = location",
      "N vendors per building",
      "Item routing to vendor ODS",
      "Single guest transaction",
      "Period-based payouts",
      "Per-vendor bank last4",
      "Vendor self-serve portal",
      "86 from vendor portal",
      "Hall cart checkout",
      "HQ multi-location rollup",
    ],
  },
  {
    domain: "Labor & staff",
    items: [
      "PIN login roles",
      "Clock in/out",
      "Scheduling",
      "Shift swaps",
      "Break tracking",
      "Tip pool calculator",
      "Training mode",
      "RBAC matrix",
      "Youth labor flags",
      "Hours export (ADP / Intuit / CSV)",
      "7shifts / Homebase",
    ],
  },
  {
    domain: "Inventory & back office",
    items: [
      "Par / on-hand",
      "Receive stock",
      "Waste log",
      "Purchasing / POs",
      "Recipes & costing",
      "Cycle counts",
      "Distributor bridges (Sysco)",
      "Bev inventory",
      "Safe drops / petty cash",
    ],
  },
  {
    domain: "CRM & marketing",
    items: [
      "Guest profiles",
      "Loyalty points",
      "Campaigns",
      "Klaviyo / Mailchimp",
      "Review requests",
      "Feedback capture",
      "House accounts",
      "Catering events",
      "Private dining rooms",
    ],
  },
  {
    domain: "Compliance & ops",
    items: [
      "Age verification",
      "Alcohol service log",
      "HACCP temp logs",
      "Allergen incidents",
      "Open/close checklists",
      "PCI checklist",
      "Avalara tax",
      "Audit trail",
      "Incident reports",
      "Brand / franchise audits",
    ],
  },
  {
    domain: "Integrations (80+)",
    items: [
      "Summex Payments (built-in)",
      "Delivery marketplaces",
      "Accounting / ERP",
      "Hours export & HR",
      "Reservations",
      "Marketing & loyalty",
      "Hardware (printers/terminals)",
      "Hotel PMS",
      "Webhooks + REST API",
      "Zapier / Make",
      "Data warehouse (Snowflake)",
      "Channel hubs (Deliverect)",
    ],
  },
  {
    domain: "Intelligence",
    items: [
      "Flash P&L",
      "Forecast",
      "Anomaly alerts",
      "Course SLA",
      "Server performance",
      "Mystery shopper scores",
      "Reports by daypart/channel",
    ],
  },
];

export function FeatureMatrixView() {
  const [q, setQ] = useState("");
  const setView = usePosStore((s) => s.setView);
  const total = MATRIX.reduce((s, d) => s + d.items.length, 0);
  const query = q.trim().toLowerCase();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Full capability matrix</h2>
          <Badge variant="success">{total}+ capabilities included</Badge>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => setView("integrations")}
          >
            Open integrations
          </Button>
        </div>
        <Input
          className="mt-2 max-w-md"
          placeholder="Filter capabilities…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="grid gap-3 lg:grid-cols-2">
          {MATRIX.map((domain) => {
            const items = domain.items.filter(
              (i) => !query || i.toLowerCase().includes(query),
            );
            if (items.length === 0) return null;
            return (
              <div
                key={domain.domain}
                className="rounded-2xl border border-border bg-surface p-4"
              >
                <h3 className="mb-2 text-sm font-semibold">{domain.domain}</h3>
                <ul className="space-y-1">
                  {items.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Demo environment: partners are simulated. Settlement, POS, and hall
          flows run fully in-browser for product evaluation.
        </p>
      </div>
    </div>
  );
}
