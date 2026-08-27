import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { useSaasStore } from "@/lib/pos/saas-store";
import { usePosStore } from "@/lib/pos/store";
import {
  addTenantSlotFn,
  generateTenantInviteFn,
  listTenantSlotsFn,
  revokeTenantInviteFn,
} from "@/lib/saas/tenant-invite-api";
import {
  TENANT_KIND_LABEL,
  TENANT_KINDS,
  type TenantInviteRow,
  type TenantKind,
} from "@/lib/saas/tenant-invite";

const STATUS_BADGE: Record<string, "secondary" | "info" | "warn" | "success" | "danger"> = {
  draft: "secondary",
  invited: "info",
  in_progress: "warn",
  complete: "success",
  expired: "danger",
};

export function TenantInvitesPanel({ write }: { write: boolean }) {
  const orgId = useSaasStore((s) => s.org.id);
  const locId = usePosStore((s) => s.tenantLocationId) || "";
  const [rows, setRows] = useState<TenantInviteRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<TenantKind>("bar");
  const [pocName, setPocName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!orgId) return;
    void listTenantSlotsFn({ data: { orgId, locationId: locId || null } })
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load tenants"));
  }, [orgId, locId]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!orgId || !locId) return;
    setBusy(true);
    setError(null);
    try {
      await addTenantSlotFn({
        data: {
          orgId,
          locationId: locId,
          displayName: name,
          stationKind: kind,
          pocName,
          email,
          phone,
        },
      });
      setName("");
      setPocName("");
      setEmail("");
      setPhone("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add tenant");
    } finally {
      setBusy(false);
    }
  };

  const invite = async (operatorId: string) => {
    setBusy(true);
    setError(null);
    try {
      const r = await generateTenantInviteFn({
        data: { operatorId, email: sendEmail, sms: sendSms },
      });
      setCopied(r.inviteUrl);
      await navigator.clipboard?.writeText(r.inviteUrl).catch(() => undefined);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send invite");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Operators / Tenants</h3>
        <GuideLearnLink topicId="tenant-invites" compact>
          Learn
        </GuideLearnLink>
      </div>
      <p className="text-xs text-muted-foreground">
        The host is fully onboarded by Summex. Each operator completes their own details from an
        email or SMS link. You still own payouts and routing.
      </p>
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {copied && (
        <p className="break-all rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs">
          Invite link (copied if the browser allowed): {copied}
        </p>
      )}
      <ul className="space-y-2">
        {(rows ?? []).map((t) => (
          <li
            key={t.operatorId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium">{t.displayName}</p>
              <p className="text-xs text-muted-foreground">
                {TENANT_KIND_LABEL[t.stationKind]}
                {t.pocName ? ` · ${t.pocName}` : ""}
                {t.email ? ` · ${t.email}` : ""}
                {t.phone ? ` · ${t.phone}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={STATUS_BADGE[t.status] ?? "secondary"}>{t.status.replaceAll("_", " ")}</Badge>
              <Badge
                variant={
                  t.paymentsStatus === "approved"
                    ? "success"
                    : t.paymentsStatus === "rejected"
                      ? "danger"
                      : t.paymentsStatus === "submitted" || t.paymentsStatus === "in_progress"
                        ? "warn"
                        : "secondary"
                }
              >
                QP {t.paymentsStatus === "approved" ? "approved" : t.paymentsStatus === "not_started" || !t.paymentsStatus ? "pending" : t.paymentsStatus.replaceAll("_", " ")}
              </Badge>
              {write && t.status !== "complete" && (
                <>
                  <Button size="sm" disabled={busy} onClick={() => void invite(t.operatorId)}>
                    {t.status === "draft" ? "Send invite" : "Resend"}
                  </Button>
                  {t.status !== "draft" && t.status !== "expired" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        void revokeTenantInviteFn({ data: { operatorId: t.operatorId } }).then(load);
                      }}
                    >
                      Revoke
                    </Button>
                  )}
                </>
              )}
            </div>
          </li>
        ))}
        {rows?.length === 0 && (
          <li className="text-sm text-muted-foreground">No tenants yet. Add a slot and send a link.</li>
        )}
      </ul>
      {write && (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h4 className="mb-3 text-sm font-semibold">Add tenant slot</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Display name</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Steam Distillery" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Type</span>
              <select
                className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                value={kind}
                onChange={(e) => setKind(e.target.value as TenantKind)}
              >
                {TENANT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {TENANT_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">POC name</span>
              <Input value={pocName} onChange={(e) => setPocName(e.target.value)} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">POC email</span>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">POC phone</span>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1…" />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
              />
              Email on send
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={sendSms}
                onChange={(e) => setSendSms(e.target.checked)}
              />
              SMS on send
            </label>
            <Button size="sm" disabled={busy || !name.trim()} onClick={() => void add()}>
              Add slot
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
