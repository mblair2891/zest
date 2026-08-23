export type IntegrationCategory =
  | "payments"
  | "delivery"
  | "accounting"
  | "payroll"
  | "reservations"
  | "marketing"
  | "loyalty"
  | "inventory"
  | "hr"
  | "comms"
  | "analytics"
  | "hardware"
  | "marketplace"
  | "hotel"
  | "compliance"
  | "devtools";

export type IntegrationStatus =
  | "available"
  | "connected"
  | "error"
  | "syncing"
  | "pending_auth";

export interface IntegrationDef {
  id: string;
  name: string;
  vendor: string;
  category: IntegrationCategory;
  description: string;
  features: string[];
  authType: "oauth" | "api_key" | "partner" | "sftp" | "webhook";
  bidirectional: boolean;
  monthlyFeeCents: number;
  popular?: boolean;
  /** Built into Summex — cannot disconnect or swap for another card processor */
  platformOwned?: boolean;
}

export interface ConnectedIntegration {
  defId: string;
  status: IntegrationStatus;
  connectedAt?: number;
  lastSyncAt?: number;
  lastError?: string;
  config: Record<string, string>;
  eventsSynced: number;
}

export interface IntegrationLog {
  id: string;
  at: number;
  defId: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
}

/** Retired merchant-facing processors. Never offer these as a choice. */
export const RETIRED_PAYMENT_PROVIDERS = [
  "stripe",
  "adyen",
  "square",
  "clover",
  "worldpay",
  "braintree",
  "toast_pay",
] as const;

export const SUMMEX_PAYMENTS_ID = "summex_payments";

function d(
  id: string,
  name: string,
  vendor: string,
  category: IntegrationCategory,
  description: string,
  features: string[],
  extras: Partial<IntegrationDef> = {},
): IntegrationDef {
  return {
    id,
    name,
    vendor,
    category,
    description,
    features,
    authType: extras.authType ?? "oauth",
    bidirectional: extras.bidirectional ?? true,
    monthlyFeeCents: extras.monthlyFeeCents ?? 0,
    popular: extras.popular,
    platformOwned: extras.platformOwned,
  };
}

export const INTEGRATION_CATALOG: IntegrationDef[] = [
  // Payments — Summex is the only processor
  d(
    SUMMEX_PAYMENTS_ID,
    "Summex Payments",
    "Summex",
    "payments",
    "Card-present, online, kiosk, and tap-to-pay. Every location processes through Summex — there is no Stripe, Square, or Clover to connect.",
    [
      "Card present + tap",
      "Online checkout",
      "Apple / Google Pay",
      "Refunds & disputes",
      "Next-day deposits",
      "Vendor period payouts",
    ],
    { authType: "partner", popular: true, platformOwned: true },
  ),
  d(
    "plaid",
    "Summex bank link",
    "Summex Payments",
    "payments",
    "Verify the house deposit account. Used only as Summex payout rails — not a separate processor.",
    ["Account verify", "Balance", "Identity"],
    { bidirectional: false, platformOwned: true },
  ),
  d(
    "dwolla",
    "Summex ACH payouts",
    "Summex Payments",
    "payments",
    "ACH credits to vendor bank accounts when a settlement period closes. Internal to Summex Payments.",
    ["ACH credit", "Mass pay", "Transfers"],
    { authType: "api_key", platformOwned: true },
  ),
  d(
    "tipalti",
    "Summex tax forms",
    "Summex Payments",
    "payments",
    "W-9 / W-8 collection for hall vendors. Runs inside Summex payouts.",
    ["W-9/W-8", "1099", "Vendor tax"],
    { authType: "api_key", platformOwned: true },
  ),

  // Delivery
  d("doordash", "DoorDash Drive + Marketplace", "DoorDash", "delivery", "Menu sync, order injection, Drive logistics.", ["Menu sync", "Orders", "Drive delivery"], { popular: true }),
  d("ubereats", "Uber Eats", "Uber", "delivery", "Marketplace orders and menu push.", ["Orders", "Menu", "Busy mode"], { popular: true }),
  d("grubhub", "Grubhub", "Grubhub", "delivery", "Marketplace orders and menu sync.", ["Orders", "Menu"]),
  d("ezcater", "ezCater", "ezCater", "delivery", "Catering marketplace leads and order intake.", ["Catering", "Leads"]),
  d("chowly", "Chowly", "Chowly", "delivery", "Aggregator for marketplace menus.", ["Menu hub"], { authType: "api_key" }),
  d("itsacheckmate", "It's a Checkmate", "Checkmate", "delivery", "Multi-marketplace order tablet replacement.", ["Orders", "Menu"]),
  d("relay", "Relay Delivery", "Relay", "delivery", "Last-mile delivery for first-party online orders.", ["Dispatch", "Tracking"]),

  // Channel hubs
  d("deliverect", "Deliverect", "Deliverect", "marketplace", "Channel hub — one menu, many marketplaces.", ["Menu", "Orders", "Busy"], { popular: true }),
  d("otter", "Otter", "Otter", "marketplace", "Tablet + hub for delivery channels.", ["Orders", "Reviews"]),
  d("checkmate_hub", "Checkmate Hub", "Checkmate", "marketplace", "Unified marketplace POS injection.", ["Orders"]),

  // Accounting
  d("quickbooks", "QuickBooks Online", "Intuit", "accounting", "Daily sales journal, tips, and tax posting.", ["Journal", "Classes", "Tips"], { popular: true }),
  d("xero", "Xero", "Xero", "accounting", "Sales and payout export for multi-entity books.", ["Journal", "Bank rec"]),
  d("netsuite", "NetSuite", "Oracle", "accounting", "Enterprise GL and intercompany for groups.", ["GL", "Subsidiaries"], { authType: "api_key" }),
  d("sage_intacct", "Sage Intacct", "Sage", "accounting", "Multi-entity restaurant group accounting.", ["Entities", "AP"]),
  d("bill_com", "BILL", "BILL", "accounting", "AP automation for invoices and vendor pay.", ["AP", "Approvals"], { authType: "oauth" }),

  // Payroll / HR
  d("adp", "ADP Workforce Now", "ADP", "payroll", "Hours, tips, and earnings export.", ["Hours", "Tips", "W-2"], { authType: "sftp", popular: true }),
  d("gusto", "Gusto", "Gusto", "payroll", "Hours and tip files for SMB payroll.", ["Hours", "Tips"]),
  d("paychex", "Paychex", "Paychex", "payroll", "Payroll export and tax filings feed.", ["Hours"], { authType: "sftp" }),
  d("seven_shifts", "7shifts", "7shifts", "hr", "Scheduling, forecasting, and labor vs sales.", ["Schedule", "Forecast", "Tips"], { popular: true }),
  d("homebase", "Homebase", "Homebase", "hr", "Scheduling and time clock sync.", ["Schedule", "Time clock"]),
  d("harri", "Harri", "Harri", "hr", "Hiring and hospitality labor OS.", ["ATS", "Schedule"]),
  d("wheniwork", "When I Work", "When I Work", "hr", "Shift scheduling and messaging.", ["Schedule"]),

  // Reservations
  d("opentable", "OpenTable", "OpenTable", "reservations", "Reservation book and covers into the host stand.", ["Book", "Covers", "No-shows"], { popular: true }),
  d("resy", "Resy", "Resy", "reservations", "Reservation sync and deposit holds via Summex Payments.", ["Book", "Deposits"]),
  d("tock", "Tock", "Tock", "reservations", "Ticketed experiences and prepaid covers.", ["Tickets", "Deposits"]),
  d("yelp_waitlist", "Yelp Waitlist", "Yelp", "reservations", "Waitlist widget into the host stand.", ["Waitlist", "SMS"]),
  d("sevenrooms", "SevenRooms", "SevenRooms", "reservations", "CRM-led reservations and auto-tags.", ["CRM", "Book"]),

  // Marketing
  d("klaviyo", "Klaviyo", "Klaviyo", "marketing", "Guest segments, flows, and campaign sync.", ["Segments", "Flows", "SMS"], { popular: true }),
  d("mailchimp", "Mailchimp", "Intuit", "marketing", "Email lists from opted-in guests.", ["Lists", "Campaigns"]),
  d("attenti", "Attenti / Review", "Attenti", "marketing", "Review request after paid checks.", ["Reviews"]),
  d("google_business", "Google Business Profile", "Google", "marketing", "Hours, posts, and review replies.", ["Posts", "Reviews"]),
  d("meta_ads", "Meta Business", "Meta", "marketing", "Audience sync for ads from opted-in guests.", ["Audiences"], { bidirectional: false }),
  d("birdeye", "Birdeye", "Birdeye", "marketing", "Review aggregation and reputation.", ["Reviews"]),

  // Loyalty
  d("punchh", "Punchh", "PAR", "loyalty", "Enterprise loyalty bridge — balances stay in Summex when using native gift.", ["Points", "Offers"]),
  d("thanx", "Thanx", "Thanx", "loyalty", "Campaign loyalty partner for groups that already use Thanx.", ["Offers"]),
  d("paytronix", "Paytronix", "Paytronix", "loyalty", "Legacy loyalty import / coexistence.", ["Points"]),

  // Inventory
  d("sysco", "Sysco", "Sysco", "inventory", "Distributor ordering and invoice ingest.", ["Order", "Invoices"], { authType: "sftp" }),
  d("usfoods", "US Foods", "US Foods", "inventory", "Distributor catalog and invoices.", ["Order", "Invoices"], { authType: "sftp" }),
  d("restaurant365", "Restaurant365", "R365", "inventory", "Back-office AP, recipes, and inventory.", ["AP", "Recipes"]),
  d("marketman", "MarketMan", "MarketMan", "inventory", "Inventory, recipes, and purchasing.", ["Inventory", "POs"]),
  d("bevager", "Bevager", "Bevager", "inventory", "Beverage inventory and costing.", ["Bev count"]),

  // Comms
  d("twilio", "Twilio SMS", "Twilio", "comms", "Waitlist, ready-for-pickup, and two-way texts.", ["SMS", "Waitlist"], { authType: "api_key", popular: true }),
  d("sendgrid", "SendGrid", "Twilio", "comms", "Receipts and campaign email.", ["Email"], { authType: "api_key" }),
  d("slack", "Slack", "Slack", "comms", "Kitchen 86 and labor alerts to a channel.", ["Alerts"]),

  // Analytics
  d("snowflake", "Snowflake", "Snowflake", "analytics", "Nightly warehouse sync of tickets and tenders.", ["ELT"], { authType: "api_key" }),
  d("bigquery", "BigQuery", "Google", "analytics", "Analytics warehouse for groups.", ["ELT"], { authType: "api_key" }),
  d("tableau", "Tableau", "Salesforce", "analytics", "Live extract of sales cubes.", ["Extracts"], { authType: "api_key", bidirectional: false }),
  d("powerbi", "Power BI", "Microsoft", "analytics", "Sales and labor datasets.", ["Datasets"], { authType: "oauth", bidirectional: false }),

  // Hardware
  d("star_micronics", "Star Micronics", "Star", "hardware", "Receipt and kitchen printers on house Wi‑Fi.", ["Receipt", "KDS print"], { authType: "partner", popular: true }),
  d("epson", "Epson TM", "Epson", "hardware", "TM-m30 / TM-T88 receipt printers.", ["Receipt"], { authType: "partner" }),
  d("bixolon", "Bixolon", "Bixolon", "hardware", "Kitchen bump printers.", ["KDS print"], { authType: "partner" }),
  d("elo", "Elo Touch", "Elo", "hardware", "Kiosk and counter touch hardware.", ["Kiosk"], { authType: "partner" }),

  // Hotel PMS
  d("opera", "Oracle Opera", "Oracle", "hotel", "Room charge and folio post from the check.", ["Folio", "Room charge"], { authType: "partner" }),
  d("mews", "Mews", "Mews", "hotel", "Modern PMS room charge.", ["Folio"]),
  d("cloudbeds", "Cloudbeds", "Cloudbeds", "hotel", "Inn / boutique hotel room charge.", ["Folio"]),

  // Compliance
  d("state_tax", "Summex sales tax", "Summex", "compliance", "Rate tables and filing export. Avalara-class engine, branded as Summex.", ["Rates", "Nexus"], { authType: "partner", platformOwned: true }),
  d("haccp_log", "HACCP logs", "Summex", "compliance", "Walk-in temps and cooling logs.", ["Temps"], { authType: "partner", platformOwned: true }),

  // Devtools
  d("webhook_out", "Outbound webhooks", "Summex", "devtools", "Push order, payment, bump, and settlement events.", ["Webhooks"], { authType: "webhook", popular: true, platformOwned: true }),
  d("public_api", "Summex REST API", "Summex", "devtools", "Partner keys for custom apps and vendor portals.", ["REST", "Keys"], { authType: "api_key", platformOwned: true }),
  d("zapier", "Zapier", "Zapier", "devtools", "No-code automations from Summex events.", ["Zaps"], { authType: "oauth", bidirectional: false }),
  d("make", "Make", "Make", "devtools", "Scenario automations from Summex webhooks.", ["Scenarios"], { authType: "api_key", bidirectional: false }),
];

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  payments: "Summex Payments",
  delivery: "Delivery & marketplaces",
  accounting: "Accounting & AP",
  payroll: "Payroll",
  reservations: "Reservations & waitlist",
  marketing: "Marketing",
  loyalty: "Loyalty partners",
  inventory: "Inventory & supply",
  hr: "Labor & HR",
  comms: "Communications",
  analytics: "Analytics & data",
  hardware: "Hardware",
  marketplace: "Channel hubs",
  hotel: "Hotel / PMS",
  compliance: "Tax & compliance",
  devtools: "API & automation",
};

/** Default connected set for a convincing demo */
export function defaultConnections(): ConnectedIntegration[] {
  const now = Date.now();
  const ids = [
    SUMMEX_PAYMENTS_ID,
    "plaid",
    "dwolla",
    "doordash",
    "ubereats",
    "quickbooks",
    "adp",
    "seven_shifts",
    "opentable",
    "klaviyo",
    "twilio",
    "state_tax",
    "deliverect",
    "webhook_out",
    "public_api",
    "star_micronics",
    "epson",
  ];
  return ids.map((defId) => ({
    defId,
    status: "connected" as const,
    connectedAt: now - 86400000 * 14,
    lastSyncAt: now - 3600000,
    config: {},
    eventsSynced: 100 + Math.floor(Math.random() * 9000),
  }));
}

export function migrateConnections(
  connections: ConnectedIntegration[],
): ConnectedIntegration[] {
  const retired = new Set<string>(RETIRED_PAYMENT_PROVIDERS);
  const next = connections.filter((c) => !retired.has(c.defId));
  if (!next.some((c) => c.defId === SUMMEX_PAYMENTS_ID)) {
    const now = Date.now();
    next.unshift({
      defId: SUMMEX_PAYMENTS_ID,
      status: "connected",
      connectedAt: now,
      lastSyncAt: now,
      config: {},
      eventsSynced: 0,
    });
  }
  return next;
}
