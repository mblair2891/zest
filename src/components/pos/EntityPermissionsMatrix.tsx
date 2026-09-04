import { Badge } from "@/components/ui/badge";
import { usePosStore } from "@/lib/pos/store";
import {
  ENTITY_GRANT_KEYS,
  ENTITY_GRANT_LABEL,
  HOST_SCOPE,
  resolveGrant,
  type EntityGrantKey,
} from "@/lib/access/entity-grants";
import { saveEntityPermissionsFn } from "@/lib/access/api";
import { isProspectDemo } from "@/lib/demo/session";
import { useSaasStore } from "@/lib/pos/saas-store";

export function EntityPermissionsMatrix({ write }: { write: boolean }) {
  const vendors = usePosStore((s) => s.vendors);
  const matrix = usePosStore((s) => s.entityPermissions);
  const setGrant = usePosStore((s) => s.setEntityGrant);
  const settings = usePosStore((s) => s.settings);
  const locId = usePosStore((s) => s.tenantLocationId) || "";
  const orgId = useSaasStore((s) => s.org.id);
  const peer = Boolean(settings.peerVenue || settings.operatingModel === "peer_venue");
  const scopes = [
    { id: HOST_SCOPE, name: peer ? "Venue admin" : settings.name || "Host" },
    ...vendors.map((v) => ({ id: v.id, name: v.shortName })),
  ];

  const persist = (
    subject: string,
    target: string,
    key: EntityGrantKey,
    value: boolean,
  ) => {
    setGrant(subject, target, { [key]: value });
    if (!isProspectDemo() && orgId && locId) {
      void saveEntityPermissionsFn({
        data: {
          orgId,
          locationId: locId,
          subjectOperatorId: subject,
          targetOperatorId: target,
          patch: { [key]: value },
        },
      }).catch(() => undefined);
    }
  };

  return (
    <section
      className="rounded-2xl border border-border bg-surface p-4"
      data-demo="entity-permissions"
    >
      <h3 className="mb-1 text-sm font-semibold">Entity permissions</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        {peer
          ? "Venue admin sets what each operator may see of another. There is no host company. Defaults: view menus, deny edits, tickets/reports/settlement own-only, devices venue-only."
          : "Host grants what each operator may see or change on another. Defaults: view menus, deny edits, tickets/reports/settlement own-only, devices host-only."}
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Subject → target</th>
              {ENTITY_GRANT_KEYS.map((k) => (
                <th key={k} className="px-2 py-2 font-medium">
                  {ENTITY_GRANT_LABEL[k]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scopes.flatMap((subject) =>
              scopes.map((target) => {
                const grant = resolveGrant(matrix, subject.id, target.id);
                const locked =
                  subject.id === HOST_SCOPE || subject.id === target.id;
                return (
                  <tr
                    key={`${subject.id}:${target.id}`}
                    className="border-b border-border/70"
                  >
                    <td className="py-2 pr-3">
                      <span className="font-medium">{subject.name}</span>
                      <span className="text-muted-foreground"> → {target.name}</span>
                      {locked && (
                        <Badge variant="secondary" className="ml-2">
                          {subject.id === HOST_SCOPE ? "Host" : "Own"}
                        </Badge>
                      )}
                    </td>
                    {ENTITY_GRANT_KEYS.map((k) => (
                      <td key={k} className="px-2 py-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border"
                          checked={grant[k]}
                          disabled={!write || locked}
                          onChange={(e) =>
                            persist(subject.id, target.id, k, e.target.checked)
                          }
                          aria-label={`${subject.name} ${ENTITY_GRANT_LABEL[k]} on ${target.name}`}
                        />
                      </td>
                    ))}
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
