import type {
  Building,
  Campaign,
  CateringEvent,
  DeliveryDriver,
  HouseAccount,
  Integration,
  Location,
  OnlineOrder,
  Promotion,
  PurchaseOrder,
  Recipe,
  ScheduleShift,
  ShiftChecklist,
  Tenant,
  TenantPayout,
} from "./platform-types";

export const BUILDINGS: Building[] = [];
export const TENANTS: Tenant[] = [];
export const LOCATIONS: Location[] = [];
export const RECIPES: Recipe[] = [];
export const PURCHASE_ORDERS: PurchaseOrder[] = [];
export const SCHEDULE: ScheduleShift[] = [];
export const PROMOTIONS: Promotion[] = [];
export const ONLINE_ORDERS: OnlineOrder[] = [];
export const CATERING: CateringEvent[] = [];
export const PAYOUTS: TenantPayout[] = [];
export const CAMPAIGNS: Campaign[] = [];
export const DRIVERS: DeliveryDriver[] = [];
export const HOUSE_ACCOUNTS: HouseAccount[] = [];
export const INTEGRATIONS: Integration[] = [];
export const CHECKLISTS: ShiftChecklist[] = [];
