/**
 * Write one station activity row from Pay or the station device screen.
 * The password and the username are not sent.
 */
import { recordStationActivityFn } from "@/lib/payments/api";
import { readStationPair } from "@/lib/pos/station-pair";
import { usePosStore } from "@/lib/pos/store";
import {
  type StationActivityAction,
  type StationActivityPresence,
} from "@/lib/payments/station-activity-log";

export function stationActivityName(): string {
  const state = usePosStore.getState();
  const pair = readStationPair();
  const id = state.activeDeviceId || pair?.deviceId || "";
  const device = id ? state.locationDevices.find((row) => row.id === id) : undefined;
  const label = device?.label?.trim();
  if (label) return label.slice(0, 80);
  if (pair?.station === "host") return "Host";
  if (pair?.station === "ods") return "Order Display";
  if (pair?.station === "kiosk") return "Kiosk";
  if (pair?.station === "order" || state.sessionKind === "pin") return "Order";
  return "Station";
}

export async function noteStationActivity(input: {
  locationId: string;
  action: StationActivityAction;
  checkEntity?: string;
  readerEntity?: string;
  result: string;
  diagnostic?: string;
  environment?: string;
  usernamePresent?: StationActivityPresence;
  passwordPresent?: StationActivityPresence;
  applicationId?: string;
  merchantId?: string;
  deviceId?: string;
}): Promise<void> {
  const locationId = input.locationId.trim();
  if (!locationId) return;
  try {
    await recordStationActivityFn({
      data: {
        locationId,
        stationName: stationActivityName(),
        action: input.action,
        environment: input.environment ?? "",
        usernamePresent: input.usernamePresent ?? "",
        passwordPresent: input.passwordPresent ?? "",
        applicationId: input.applicationId ?? "",
        merchantId: input.merchantId ?? "",
        deviceId: input.deviceId ?? "",
        checkEntity: input.checkEntity ?? "",
        readerEntity: input.readerEntity ?? "",
        result: input.result,
        diagnostic: input.diagnostic ?? "",
      },
    });
  } catch {
    /* The pay banner still shows when the log cannot be written. */
  }
}
