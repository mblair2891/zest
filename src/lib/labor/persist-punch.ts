import type { TimePunch } from "@/lib/pos/ops-types";
import { stationFloorFields } from "@/lib/pos/station-pair";

/** Fire-and-forget clock punch to the location (entity-scoped). */
export function persistPunchToServer(punch: TimePunch): void {
  void Promise.all([
    import("@/lib/pos/saas-store"),
    import("@/lib/pos/store"),
    import("./api"),
  ])
    .then(([{ useSaasStore }, { usePosStore }, { upsertPunchFn }]) => {
      const orgId = useSaasStore.getState().org.id;
      const locationId = usePosStore.getState().tenantLocationId;
      if (!orgId || !locationId) return;
      const station = stationFloorFields();
      return upsertPunchFn({
        data: {
          orgId,
          locationId,
          stationDeviceId: station?.stationDeviceId,
          stationPin: station?.stationPin,
          punch: {
            id: punch.id,
            employeeId: punch.employeeId,
            employeeName: punch.employeeName,
            employerId: punch.operatorId || "host",
            clockInAt: punch.clockInAt,
            clockOutAt: punch.clockOutAt ?? null,
            regularMinutes: punch.regularMinutes ?? 0,
            otMinutes: punch.otMinutes ?? 0,
            status: punch.status,
          },
        },
      });
    })
    .catch(() => undefined);
}
