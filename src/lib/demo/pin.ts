import { isProspectDemo } from "./session";

/** Universal staff PIN for prospect demo venues only. Never used on live tenants. */
export const DEMO_STAFF_PIN = "0000";

export function isDemoStaffPin(pin: string): boolean {
  return isProspectDemo() && pin.replace(/\D/g, "") === DEMO_STAFF_PIN;
}
