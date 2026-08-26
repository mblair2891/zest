import {
  HOST_SCOPE,
  canEntityGrant,
  parseGrantMatrix,
  type EntityGrantKey,
  type EntityGrantRow,
} from "./entity-grants";

const HOST_WRITE = new Set(["owner", "manager", "platform_admin"]);

/** Pure: vendor_operator only writes own operator unless the host matrix grants it. */
export function canWriteEntityResource(opts: {
  isPlatformAdmin: boolean;
  role: string;
  operatorId: string;
  resourceOperatorId: string | null | undefined;
  matrix?: EntityGrantRow[] | unknown;
  grant?: EntityGrantKey;
}): boolean {
  if (opts.isPlatformAdmin) return true;
  const grant = opts.grant ?? "edit_menu";
  const subject = (opts.operatorId || HOST_SCOPE).trim() || HOST_SCOPE;
  const target = (opts.resourceOperatorId || HOST_SCOPE).trim() || HOST_SCOPE;
  if (opts.role !== "vendor" && HOST_WRITE.has(opts.role) && subject === HOST_SCOPE) {
    return true;
  }
  if (subject === target && grant !== "manage_devices") return true;
  const matrix = Array.isArray(opts.matrix)
    ? (opts.matrix as EntityGrantRow[])
    : parseGrantMatrix(opts.matrix);
  return canEntityGrant(matrix, subject, target, grant);
}
