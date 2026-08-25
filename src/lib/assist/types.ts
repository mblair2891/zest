export const ASSIST_DOMAINS = [
  "menu_item",
  "category",
  "modifier",
  "floor",
  "operator",
  "station",
  "staff",
  "location",
  "cash_discount",
] as const;

export type AssistDomain = (typeof ASSIST_DOMAINS)[number];

export const ASSIST_DOMAIN_LABEL: Record<AssistDomain, string> = {
  menu_item: "Menu item",
  category: "Category",
  modifier: "Modifiers",
  floor: "Floor & tables",
  operator: "Operator / vendor",
  station: "Station routing",
  staff: "Staff",
  location: "Location profile",
  cash_discount: "Cash discount",
};

export type AssistSource = "ai" | "guided";

export type AssistMessage = {
  role: "user" | "assistant";
  text: string;
};

export type AssistQuestion = {
  id: string;
  prompt: string;
  hint?: string;
};

export type AssistContext = {
  locationId?: string;
  locationName?: string;
  timezone?: string;
  hostMultiOperator: boolean;
  cashDiscountEnabled: boolean;
  cashDiscountPercent: number;
  cashRoundIncrement: number;
  categories: Array<{ id: string; name: string; station: string }>;
  operators: Array<{ id: string; name: string; stationType?: string }>;
  sections: Array<{ id: string; name: string }>;
  /** Guest operator login: lock drafts to this entity. */
  scopedVendorId?: string;
  scopedVendorName?: string;
  existingModifiers?: Array<{ id: string; name: string; options: string[] }>;
  seedItem?: {
    id: string;
    name: string;
    description?: string;
    priceCents: number;
    categoryId: string;
    station: string;
    course: string;
    vendorId?: string;
    modifierGroupIds: string[];
  };
};

export type SuggestedModifierGroup = {
  name: string;
  required: boolean;
  min: number;
  max: number;
  options: Array<{ name: string; priceCents: number }>;
};

export type MenuItemDraft = {
  domain: "menu_item";
  name: string;
  description: string;
  priceCents: number;
  priceBasis: "card" | "cash";
  categoryName: string;
  categoryId?: string;
  station: "kitchen" | "bar" | "expo" | "dessert";
  vendorId?: string;
  vendorName?: string;
  modifierHint?: string;
  course: "appetizer" | "salad" | "entree" | "side" | "dessert" | "drink" | "other";
  /** When set, Confirm updates this item instead of creating. */
  itemId?: string;
  modifierGroups?: SuggestedModifierGroup[];
  omitPresets?: string[];
  addPresets?: Array<{ name: string; priceCents: number }>;
};

export type CategoryDraft = {
  domain: "category";
  name: string;
  station: "kitchen" | "bar" | "expo" | "dessert";
};

export type ModifierDraft = {
  domain: "modifier";
  name: string;
  required: boolean;
  min: number;
  max: number;
  options: Array<{ name: string; priceCents: number }>;
};

export type FloorDraft = {
  domain: "floor";
  sections: Array<{
    name: string;
    tables: Array<{ label: string; seats: number }>;
  }>;
};

export type OperatorDraft = {
  domain: "operator";
  name: string;
  shortName: string;
  stationType: "bar" | "kitchen" | "both";
  payoutNote?: string;
};

export type StationDraft = {
  domain: "station";
  rules: Array<{
    target: string;
    station: "kitchen" | "bar" | "expo" | "dessert";
  }>;
};

export type StaffDraft = {
  domain: "staff";
  name: string;
  email?: string;
  role: "owner" | "manager" | "server" | "bartender" | "host" | "kitchen" | "busser";
};

export type LocationDraft = {
  domain: "location";
  name?: string;
  timezone?: string;
  serviceStyle?: string;
};

export type CashDiscountDraft = {
  domain: "cash_discount";
  enabled: boolean;
  percent: number;
  increment: 0.25 | 0.5 | 0.75 | 1;
};

export type AssistDraft =
  | MenuItemDraft
  | CategoryDraft
  | ModifierDraft
  | FloorDraft
  | OperatorDraft
  | StationDraft
  | StaffDraft
  | LocationDraft
  | CashDiscountDraft;

export type AssistTurnResult =
  | { type: "questions"; questions: AssistQuestion[]; source: AssistSource }
  | { type: "draft"; draft: AssistDraft; source: AssistSource };
