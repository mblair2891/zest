/** Summex hardware policy + certified device catalog (with vendor sources) */

export type HardwareAcquireMode = "byod" | "buy" | "finance" | "subscribe";

export type HardwareCategory =
  | "compute"
  | "payments"
  | "print"
  | "cash"
  | "network"
  | "mount";

export interface HardwareSku {
  id: string;
  name: string;
  category: HardwareCategory;
  role: string;
  /** Indicative USD list (street varies) */
  listPriceUsd: number;
  subscribeMonthlyUsd?: number;
  byodOk: boolean;
  required?: boolean;
  notes: string;
  /** Official or primary buy sources */
  sources: { label: string; url: string }[];
}

export interface HardwareKit {
  id: string;
  name: string;
  bestFor: string;
  skuIds: string[];
  buyTotalUsd: number;
  financeMonthlyUsd: number; // 36-mo illustrative
  subscribeMonthlyUsd: number;
}

export const HARDWARE_POLICY = {
  title: "Summex Hardware Policy",
  version: "1.0",
  summary:
    "BYOD-first software. Certified payments & printers. Optional buy, 24–36 mo partner finance, or device subscription — never a mystery 48-month ISO trap.",
  principles: [
    "Software runs on customer-owned tablets/phones/desktops (BYOD) by default.",
    "Site fabric is WiFi-first: one business AP, staff SSID, isolated guest. No CAT6 to every station.",
    "Internet is only the uplink. If the ISP dies, house WiFi still carries POS, ODS, printers, and handhelds to the hub.",
    "Card-present payments use certified Stripe Terminal (or successor) only — not random NFC dongles.",
    "Receipt/kitchen printers: Star Micronics or Epson network models on the certified list.",
    "Four acquire paths: BYOD · Buy kit · Partner finance (24–36 mo, $1 buyout target) · Device subscription (Summex-owned fleet).",
    "Hardware contracts are separate from software SaaS and from card processing rates.",
    "No long ‘free terminal’ deals that bury cost in opaque processing without a written comparison.",
    "Food halls: vendors BYOD handhelds; host may buy/subscribe shared ODS, network, and settlement station.",
    "Truck pods: BYOD-first; pad power/network is site infrastructure, not per-truck 4-year paper.",
  ],
  modes: [
    {
      id: "byod" as HardwareAcquireMode,
      name: "Bring your own (BYOD)",
      customerPays: "Devices they already own",
      summexRole: "Certify OS/browser; enroll in Devices",
      when: "Default for software, halls vendors, pods",
    },
    {
      id: "buy" as HardwareAcquireMode,
      name: "Buy Summex Ready Kit",
      customerPays: "Invoice once (kit COGS + margin)",
      summexRole: "Ship pre-imaged certified gear",
      when: "Stable restaurants/hall hosts with cash",
    },
    {
      id: "finance" as HardwareAcquireMode,
      name: "Partner finance",
      customerPays: "24–36 monthly payments; target $1 buyout",
      summexRole: "Originate; lessor funds & underwrites",
      when: "Want kit without CapEx; pass credit check",
    },
    {
      id: "subscribe" as HardwareAcquireMode,
      name: "Device subscription",
      customerPays: "$/device/mo; swap on failure",
      summexRole: "Own fleet, RMA, refresh ~36 mo",
      when: "Always-on ODS/counters; managed sites",
    },
  ],
  financeGuardrails: [
    "Prefer 24–36 months; avoid 48–60 unless customer insists in writing.",
    "Disclose total of payments vs buy price on every quote.",
    "Personal guarantee and ETF stated on finance docs (partner paper).",
    "Hardware paper survives software cancel only if finance is with third party — say so upfront.",
    "Summex does not book leases on balance sheet in v1; partner lessor does.",
  ],
  supportMatrix: [
    { item: "iPad / Android tablet POS", support: "BYOD supported (see min OS)" },
    { item: "Stripe Terminal readers", support: "Required for live card-present" },
    { item: "Star / Epson LAN printers", support: "Certified; others best-effort" },
    { item: "Cash drawer (printer-kick)", support: "Optional; APG/Star common" },
    { item: "Consumer phone as sole ODS", support: "Not recommended (battery/brightness)" },
  ],
} as const;

export const HARDWARE_SKUS: HardwareSku[] = [

  {
    id: "sku_galaxy_test",
    name: "Samsung Galaxy tablet (your test fleet ×2)",
    category: "compute",
    role: "Floor server + Bar/Manager",
    listPriceUsd: 0,
    byodOk: true,
    notes: "BYOD test units. Landscape Chrome; Install app / Add to Home screen. Assign A=Server, B=Bar or Manager.",
    sources: [
      { label: "Samsung tablets", url: "https://www.samsung.com/us/tablets/" },
      { label: "Samsung tablets", url: "https://www.samsung.com/us/tablets/" },
    ],
  },
  {
    id: "sku_android_27_test",
    name: '27" Android touchscreen display (your ODS)',
    category: "compute",
    role: "Kitchen expo ODS",
    listPriceUsd: 0,
    byodOk: true,
    notes: "Large-format Android touch. Use Kitchen login + /?station=kitchen. Stay awake while plugged in; zoom 110% if tickets feel small.",
    sources: [
      {
        label: "Android large-format / commercial touch (category)",
        url: "https://www.samsung.com/us/business/displays/",
      },
    ],
  },
  {
    id: "sku_ipad",
    name: "Apple iPad (10.9\" / 11\")",
    category: "compute",
    role: "Counter POS / host stand",
    listPriceUsd: 349,
    subscribeMonthlyUsd: 29,
    byodOk: true,
    notes: "Safari or Chrome; guided access recommended. Min recent iPadOS.",
    sources: [
      { label: "Apple Store — iPad", url: "https://www.apple.com/ipad/" },
      {
        label: "Apple Business",
        url: "https://www.apple.com/business/",
      },
    ],
  },
  {
    id: "sku_ipad_mini",
    name: "Apple iPad mini",
    category: "compute",
    role: "Server handheld",
    listPriceUsd: 499,
    subscribeMonthlyUsd: 35,
    byodOk: true,
    notes: "Best BYOD handheld form factor for floor service.",
    sources: [
      { label: "Apple Store — iPad mini", url: "https://www.apple.com/ipad-mini/" },
    ],
  },
  {
    id: "sku_android_tab",
    name: "Android tablet 10\" (Samsung/Lenovo class)",
    category: "compute",
    role: "Counter POS / ODS",
    listPriceUsd: 229,
    subscribeMonthlyUsd: 25,
    byodOk: true,
    notes: "Chrome; Android 12+. Prefer Wi-Fi 6, 4GB+ RAM for ODS.",
    sources: [
      {
        label: "Samsung Galaxy Tab",
        url: "https://www.samsung.com/us/tablets/",
      },
      {
        label: "Lenovo tablets",
        url: "https://www.lenovo.com/us/en/tablets/",
      },
    ],
  },
  {
    id: "sku_stripe_m2",
    name: "Summex Reader handheld",
    category: "payments",
    role: "Mobile / Bluetooth card reader",
    listPriceUsd: 59,
    subscribeMonthlyUsd: 12,
    byodOk: false,
    required: true,
    notes: "Chip, tap, swipe. White-label reader issued with Summex Payments.",
    sources: [
      { label: "Summex Payments hardware", url: "https://summex.example/hardware" },
    ],
  },
  {
    id: "sku_stripe_s700",
    name: "Summex Reader counter",
    category: "payments",
    role: "Smart countertop / handheld reader",
    listPriceUsd: 299,
    subscribeMonthlyUsd: 29,
    byodOk: false,
    required: true,
    notes: "Tap/chip/swipe on house Wi‑Fi. Primary counter reader.",
    sources: [
      { label: "Summex Payments hardware", url: "https://summex.example/hardware" },
    ],
  },
  {
    id: "sku_stripe_s710",
    name: "Summex Reader cellular",
    category: "payments",
    role: "Cellular-capable smart reader",
    listPriceUsd: 299,
    subscribeMonthlyUsd: 35,
    byodOk: false,
    notes: "For pods / pop-ups where Wi‑Fi is weak.",
    sources: [
      { label: "Summex Payments hardware", url: "https://summex.example/hardware" },
    ],
  },
  {
    id: "sku_star_mcprint3",
    name: "Star Micronics mC-Print3",
    category: "print",
    role: "Receipt / front counter",
    listPriceUsd: 320,
    subscribeMonthlyUsd: 18,
    byodOk: true,
    notes: "Compact LAN/cloud-friendly; strong tablet-POS ecosystem.",
    sources: [
      {
        label: "Star Micronics thermal printers",
        url: "https://starmicronics.com/thermal-pos-receipt-printers/",
      },
      {
        label: "Star mC-Print line (blog overview)",
        url: "https://starmicronics.com/blog/the-5-best-star-receipt-printers/",
      },
    ],
  },
  {
    id: "sku_epson_m30",
    name: "Epson TM-m30 series",
    category: "print",
    role: "Receipt printer",
    listPriceUsd: 280,
    subscribeMonthlyUsd: 16,
    byodOk: true,
    notes: "Common compact Epson; Ethernet preferred over USB-only.",
    sources: [
      {
        label: "Epson POS printers",
        url: "https://epson.com/For-Work/Printers/POS/c/w330",
      },
    ],
  },
  {
    id: "sku_epson_kitchen",
    name: "Epson TM-T88 / kitchen impact or thermal",
    category: "print",
    role: "Kitchen ticket printer",
    listPriceUsd: 400,
    subscribeMonthlyUsd: 22,
    byodOk: true,
    notes: "Use for expo backup when ODS is down; LAN.",
    sources: [
      {
        label: "Epson POS printers",
        url: "https://epson.com/For-Work/Printers/POS/c/w330",
      },
    ],
  },
  {
    id: "sku_apg_drawer",
    name: "APG cash drawer (printer-driven)",
    category: "cash",
    role: "Cash drawer",
    listPriceUsd: 140,
    subscribeMonthlyUsd: 8,
    byodOk: true,
    notes: "Kick via printer RJ11/RJ12; match cable to printer.",
    sources: [
      { label: "APG Cash Drawer", url: "https://www.apgcashdrawer.com/" },
    ],
  },
  {
    id: "sku_star_mpop",
    name: "Star mPOP (printer + drawer)",
    category: "cash",
    role: "Compact tablet station",
    listPriceUsd: 450,
    subscribeMonthlyUsd: 28,
    byodOk: false,
    notes: "Integrated drawer + 2\" printer for tight counters.",
    sources: [
      {
        label: "Star mPOP overview",
        url: "https://starmicronics.com/blog/the-5-best-star-receipt-printers/",
      },
    ],
  },
  {
    id: "sku_kds_display",
    name: "21–24\" commercial display + mount",
    category: "compute",
    role: "Kitchen / bar ODS screen",
    listPriceUsd: 220,
    subscribeMonthlyUsd: 15,
    byodOk: true,
    notes: "Drive with dedicated tablet or mini-PC; always plugged in.",
    sources: [
      {
        label: "Example commercial displays (Samsung)",
        url: "https://www.samsung.com/us/business/displays/",
      },
    ],
  },
  {
    id: "sku_stand",
    name: "Counter tablet stand / enclosure",
    category: "mount",
    role: "Mount",
    listPriceUsd: 90,
    subscribeMonthlyUsd: 6,
    byodOk: true,
    notes: "Heckler / Rise / equivalent; secure cable routing.",
    sources: [
      { label: "Heckler Design", url: "https://www.hecklerdesign.com/" },
    ],
  },
  {
    id: "sku_router",
    name: "Business Wi‑Fi router / merch VLAN capable",
    category: "network",
    role: "Site network",
    listPriceUsd: 180,
    subscribeMonthlyUsd: 12,
    byodOk: true,
    notes:
      "WiFi 6/6E preferred. Staff SSID isolated from guest. Ethernet on the AP WAN port only — stations stay wireless. If the ISP drops, LAN still bridges the house.",
    sources: [
      {
        label: "Ubiquiti UniFi",
        url: "https://www.ui.com/",
      },
      {
        label: "Cisco Meraki Go / Meraki",
        url: "https://meraki.cisco.com/",
      },
    ],
  },
];

export const HARDWARE_KITS: HardwareKit[] = [
  {
    id: "kit_counter",
    name: "Counter Ready Kit",
    bestFor: "Single register restaurant / bar",
    skuIds: [
      "sku_ipad",
      "sku_stand",
      "sku_stripe_s700",
      "sku_star_mcprint3",
      "sku_apg_drawer",
    ],
    buyTotalUsd: 349 + 90 + 299 + 320 + 140,
    financeMonthlyUsd: 42,
    subscribeMonthlyUsd: 29 + 6 + 29 + 18 + 8,
  },
  {
    id: "kit_handheld",
    name: "Handheld Service Kit",
    bestFor: "Servers / hall runners",
    skuIds: ["sku_ipad_mini", "sku_stripe_m2"],
    buyTotalUsd: 499 + 59,
    financeMonthlyUsd: 22,
    subscribeMonthlyUsd: 35 + 12,
  },
  {
    id: "kit_kds",
    name: "ODS Station Kit",
    bestFor: "Kitchen or bar expo",
    skuIds: ["sku_android_tab", "sku_kds_display", "sku_stand"],
    buyTotalUsd: 229 + 220 + 90,
    financeMonthlyUsd: 18,
    subscribeMonthlyUsd: 25 + 15 + 6,
  },
  {
    id: "kit_hall_host",
    name: "Hall Host Pack",
    bestFor: "Food hall building operator",
    skuIds: [
      "sku_ipad",
      "sku_stand",
      "sku_stripe_s700",
      "sku_star_mcprint3",
      "sku_kds_display",
      "sku_router",
    ],
    buyTotalUsd: 349 + 90 + 299 + 320 + 220 + 180,
    financeMonthlyUsd: 55,
    subscribeMonthlyUsd: 29 + 6 + 29 + 18 + 15 + 12,
  },
];

export function skuById(id: string) {
  return HARDWARE_SKUS.find((s) => s.id === id);
}
