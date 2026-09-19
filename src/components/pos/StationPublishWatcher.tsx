import { useEffect } from "react";
import { getStationPublishFn, getStationStateFn } from "@/lib/access/api";
import { kickStationToPair } from "@/lib/pos/station-kick";
import { readStationPair } from "@/lib/pos/station-pair";
import {
  applyPendingIfIdle,
  isMidTicket,
  readPublishState,
  stashOrApplyPublish,
} from "@/lib/pos/station-publish";
import {
  applyPendingDeviceRoleIfIdle,
  ingestServerDeviceRole,
} from "@/lib/pos/station-role-sync";
import { usePosStore } from "@/lib/pos/store";
import { deliverRawPrint } from "@/lib/print/dispatch";
import { claimStationPrintFn, completeStationPrintFn } from "@/lib/print/api";
import { heartbeatLocationDeviceFn } from "@/lib/access/api";
import { readStationDeviceRole } from "@/lib/pos/device-roles";
import {
  currentConfigVersion,
  ingestHeartbeat,
  tryApplyStationRefresh,
} from "@/lib/pos/station-refresh";

const STATE_POLL_MS = 5_000;
const PUBLISH_POLL_MS = 20_000;
const IDLE_TICK_MS = 1_000;

function pollStationState(): void {
  const pair = readStationPair();
  const locationId = pair?.locationId || "";
  const deviceId = pair?.deviceId || "";
  if (!locationId || !deviceId) return;
  void getStationStateFn({ data: { locationId, deviceId } })
    .then((res) => {
      if (res && !res.ok && res.revoked) kickStationToPair();
    })
    .catch(() => undefined);
  void heartbeatLocationDeviceFn({
    data: { locationId, deviceId, sinceConfig: currentConfigVersion() },
  })
    .then((res) => ingestHeartbeat(res))
    .catch(() => undefined);
  const role = readStationDeviceRole() ?? pair?.station ?? "order";
  void claimStationPrintFn({ data: { locationId, deviceId, role } })
    .then(async (res) => {
      const job = res.job;
      if (!job) return;
      const ok = await deliverRawPrint(job.host, job.port, job.escposBase64);
      await completeStationPrintFn({
        data: { locationId, deviceId, jobId: job.id, ok },
      });
    })
    .catch(() => undefined);
}

/** Idle PIN pad pulls a new publish. Pair liveness every 5s. */
export function StationPublishWatcher() {
  const currentEmployeeId = usePosStore((s) => s.currentEmployeeId);
  const locationId = usePosStore((s) => s.tenantLocationId);

  useEffect(() => {
    if (!currentEmployeeId) {
      applyPendingIfIdle();
      applyPendingDeviceRoleIfIdle({ staffOpen: false, midTicket: isMidTicket() });
      tryApplyStationRefresh();
    }
  }, [currentEmployeeId]);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const stateTick = () => {
      if (cancelled) return;
      pollStationState();
    };
    const publishTick = () => {
      if (cancelled) return;
      const pair = readStationPair();
      const deviceId = pair?.deviceId || "";
      if (!deviceId) return;
      const since = readPublishState()?.appliedVersion ?? 0;
      void getStationPublishFn({
        data: { locationId, deviceId, sinceVersion: since },
      })
        .then((res) => {
          if (cancelled) return;
          if ("revoked" in res && res.revoked) {
            kickStationToPair();
            return;
          }
          if (res.device) {
            ingestServerDeviceRole(res.device, {
              staffOpen: Boolean(usePosStore.getState().currentEmployeeId),
              midTicket: isMidTicket(),
            });
          }
          if (res.upToDate || !res.publish) return;
          stashOrApplyPublish(res.publish);
        })
        .catch(() => undefined);
    };
    stateTick();
    publishTick();
    const stateId = window.setInterval(stateTick, STATE_POLL_MS);
    const pubId = window.setInterval(publishTick, PUBLISH_POLL_MS);
    const idleId = window.setInterval(() => {
      if (cancelled) return;
      tryApplyStationRefresh();
    }, IDLE_TICK_MS);
    return () => {
      cancelled = true;
      window.clearInterval(stateId);
      window.clearInterval(pubId);
      window.clearInterval(idleId);
    };
  }, [locationId, currentEmployeeId]);

  return null;
}
