/** Bound receipt printer may kick a drawer. Kitchen Star never kicks. */

import { receiptDrawerKickAllowed } from "../pos/no-sale";
import {
  resolveReceiptKickPrinter,
  type ReceiptBindDevice,
  type ReceiptBindRole,
} from "./receipt-bind";

export { receiptDrawerKickAllowed, NO_DRAWER_ON_STATION } from "../pos/no-sale";

export type ReceiptDrawerDevice = ReceiptBindDevice & {
  label?: string;
  print?: ReceiptBindDevice["print"] & {
    drawerKick?: string;
    emulation?: string;
    destinationName?: string;
  };
};

export function resolveReceiptDrawer(
  devices: ReceiptDrawerDevice[] | undefined,
  stationDeviceId: string | null | undefined,
  role?: ReceiptBindRole | null,
): ReceiptDrawerDevice | undefined {
  const prn = resolveReceiptKickPrinter(devices, stationDeviceId, role) as ReceiptDrawerDevice | undefined;
  if (!prn || !receiptDrawerKickAllowed(prn)) return undefined;
  return prn;
}
