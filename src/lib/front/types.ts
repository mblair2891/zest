export const WAITLIST_REASONS = [
  "kitchen_backed_up",
  "short_kitchen_staff",
  "short_floor_staff",
  "at_capacity",
  "custom",
] as const;

export type WaitlistReason = (typeof WAITLIST_REASONS)[number];

export const WAITLIST_REASON_LABEL: Record<WaitlistReason, string> = {
  kitchen_backed_up: "Kitchen backed up",
  short_kitchen_staff: "Short kitchen staff",
  short_floor_staff: "Short floor staff",
  at_capacity: "At capacity",
  custom: "Custom",
};

export type KioskMode = "order" | "checkin" | "combined";

export type ReservationStatus = "booked" | "checked_in" | "cancelled" | "no_show";

export type WaitlistStatus =
  | "waiting"
  | "notified"
  | "seated"
  | "cancelled"
  | "no_show"
  | "removed";

export type FrontSettings = {
  locationId: string;
  kioskMode: KioskMode;
  waitlistEnabled: boolean;
  waitlistReason: WaitlistReason | null;
  waitlistReasons: WaitlistReason[];
  smsFrom: string | null;
  smsEnabled: boolean;
  smsMonthlyCap: number | null;
};

export type ReservationRecord = {
  id: string;
  locationId: string;
  name: string;
  partySize: number;
  at: string;
  phone: string | null;
  email: string | null;
  checkInCode: string;
  status: ReservationStatus;
  tableSuggestion: string | null;
  notes: string | null;
  createdAt: string;
};

export type WaitlistRecord = {
  id: string;
  locationId: string;
  name: string;
  partySize: number;
  phone: string;
  quotedMinutes: number;
  status: WaitlistStatus;
  optOutToken: string;
  notes: string | null;
  createdAt: string;
  notifiedAt: string | null;
};

export type WaitEstimate = {
  minutes: number;
  low: number;
  high: number;
  label: string;
  rationale: string;
  source: "heuristic" | "ai";
};

export type MessageLogRow = {
  id: string;
  channel: "sms" | "email";
  to: string;
  subject: string | null;
  body: string;
  provider: string;
  kind: string;
  locationId: string | null;
  createdAt: string;
};

export const DEFAULT_FRONT_SETTINGS: Omit<FrontSettings, "locationId"> = {
  kioskMode: "combined",
  waitlistEnabled: true,
  waitlistReason: "at_capacity",
  waitlistReasons: [...WAITLIST_REASONS],
  smsFrom: null,
  smsEnabled: true,
  smsMonthlyCap: null,
};
