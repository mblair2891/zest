import type {
  Customer,
  Employee,
  GiftCard,
  InventoryItem,
  MenuCategory,
  MenuItem,
  ModifierGroup,
  Reservation,
  RestaurantSettings,
  Table,
  WaitlistEntry,
  Vendor,
  SettlementConfig,
  ExtraTableGrant,
} from "./types";
import { DEFAULT_SECTION_POLICY } from "./section-control";

/** Product defaults — not a tenant. Location onboarding overwrites name/address. */
export const SETTINGS: RestaurantSettings = {
  name: "Zest",
  address: "",
  phone: "",
  taxRate: 0.0875,
  autoGratPercent: 0.2,
  autoGratPartySize: 6,
  happyHourEnabled: false,
  happyHourStart: 15,
  happyHourEnd: 18,
  happyHourDays: [1, 2, 3, 4, 5],
  currency: "USD",
  receiptFooter: "Thank you. Charged via Zest Payments.",
  managerPin: "0000",
  serviceChargeLabel: "Auto-gratuity",
  multiTenantHallMode: false,
  onlineOrderingEnabled: true,
  qrOrderingEnabled: true,
  sectionPolicy: { ...DEFAULT_SECTION_POLICY },
};

export const EMPLOYEES: Employee[] = [];
export const VENDORS: Vendor[] = [];
export const CATEGORIES: MenuCategory[] = [];
export const MODIFIER_GROUPS: ModifierGroup[] = [];
export const MENU_ITEMS: MenuItem[] = [];
export const TABLES: Table[] = [];
export const WAITLIST: WaitlistEntry[] = [];
export const RESERVATIONS: Reservation[] = [];
export const CUSTOMERS: Customer[] = [];
export const GIFT_CARDS: GiftCard[] = [];
export const INVENTORY: InventoryItem[] = [];
export const EXTRA_TABLE_GRANTS: ExtraTableGrant[] = [];

export const SETTLEMENT_CONFIG: SettlementConfig = {
  locationId: "",
  locationName: "",
  periodType: "weekly",
  customPeriodDays: 7,
  cardFeePercent: 2.9,
  hostCutEnabled: true,
  hostCutType: "percent_of_gross",
  hostCutPercent: 5,
  hostCutFixedCents: 0,
  hostName: "",
  taxRemittedBy: "host",
  tipPoolWithVendors: false,
  currentPeriodStart: (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d.getTime();
  })(),
};
