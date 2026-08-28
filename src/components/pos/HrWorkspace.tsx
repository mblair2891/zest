import { useCallback, useEffect, useMemo, useState } from "react";
import { IdCard, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { usePosStore } from "@/lib/pos/store";
import { useSaasStore } from "@/lib/pos/saas-store";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { isProspectDemo } from "@/lib/demo/session";
import { formatCurrency } from "@/lib/utils";
import { buildPayrollRows, payrollCsv } from "@/lib/labor/payroll";
import { useOpsStore } from "@/lib/pos/ops-store";
import {
  APPLICANT_STAGES,
  HR_AUDIENCE_LABEL,
  HR_AUDIENCES,
  HR_FEATURE_KEYS,
  HR_FEATURE_LABEL,
  HR_VISIBILITY_KEYS,
  HR_VISIBILITY_LABEL,
  type EntityHrConfig,
  type HrApplicant,
  type HrAudience,
  type HrAvailability,
  type HrEligibility,
  type HrFeatureKey,
  type HrOnboarding,
  type HrPacket,
  type HrTimeOff,
  type HrVisibilityKey,
  type HrWriteup,
} from "@/lib/hr/types";
import { packetsForState, US_STATES, type PacketTemplate } from "@/lib/hr/packets";
import {
  addHrWriteupFn,
  attachHrI9FileFn,
  hrOverviewFn,
  hrPacketFileFn,
  hrPacketOutboxFn,
  hrPayrollSummaryFn,
  listHrApplicantsFn,
  listHrAvailabilityFn,
  listHrEligibilityFn,
  listHrOnboardingFn,
  listHrPacketsFn,
  listHrTimeOffFn,
  listHrWriteupsFn,
  markHrPacketFn,
  patchHrOnboardingFn,
  saveHrPiiFn,
  saveHrSettingsFn,
  sendHrPacketFn,
  setHrAvailabilityFn,
  setHrEligibilityFn,
  startHrOnboardingFn,
  upsertHrApplicantFn,
  upsertHrTimeOffFn,
  viewHrPiiFn,
} from "@/lib/hr/api";

type Tab =
  | "settings"
  | "applicants"
  | "onboarding"
  | "packets"
  | "timeoff"
  | "writeups"
  | "availability"
  | "eligibility"
  | "payroll";

type Overview = {
  employerEntityId: string;
  employmentState: string;
  config: EntityHrConfig;
  packets: PacketTemplate[];
  esign: { configured: boolean; provider: string | null; label: string };
  piiReady: boolean;
  isPlatformAdmin: boolean;
  isHost: boolean;
  role: string;
};

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Request failed";
}

export function HrWorkspace() {
  const orgId = useSaasStore((s) => s.org.id);
  const locationId = usePosStore((s) => s.tenantLocationId) || "";
  const employees = usePosStore((s) => s.employees);
  const vendors = usePosStore((s) => s.vendors);
  const settings = usePosStore((s) => s.settings);
  const current = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const punches = useOpsStore((s) => s.punches);
  const hostName = settings.name || "Host";

  const isVendor = current?.role === "vendor_operator";
  const defaultEmployer = isVendor ? current?.operatorId || HOST_SCOPE : HOST_SCOPE;
  const [employerId, setEmployerId] = useState(defaultEmployer);
  const [tab, setTab] = useState<Tab>("settings");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const scope = useMemo(
    () => ({ orgId, locationId, employerId }),
    [orgId, locationId, employerId],
  );

  const staff = useMemo(
    () =>
      employees.filter((e) => {
        if (!e.active) return false;
        const op = e.operatorId || HOST_SCOPE;
        return op === employerId;
      }),
    [employees, employerId],
  );

  const loadOverview = useCallback(async () => {
    if (!orgId || !locationId || isProspectDemo()) return;
    try {
      const o = await hrOverviewFn({ data: { ...scope } });
      setOverview(o);
    } catch (e) {
      setFlash(errMsg(e));
    }
  }, [orgId, locationId, scope]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const features = overview?.config.features;
  const enabled = overview?.config.enabled ?? false;
  const admin =
    current?.role === "owner" ||
    current?.role === "manager" ||
    current?.role === "vendor_operator" ||
    current?.role === "accountant";

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "settings", label: "Flags", show: admin },
    { id: "applicants", label: "Hiring", show: Boolean(enabled && features?.applicants && admin) },
    { id: "onboarding", label: "Onboarding", show: Boolean(enabled && features?.onboardingPackets && admin) },
    { id: "packets", label: "Packets", show: Boolean(enabled && features?.onboardingPackets && admin) },
    { id: "timeoff", label: "Time-off", show: Boolean(enabled && features?.timeOff) },
    { id: "writeups", label: "Write-ups", show: Boolean(enabled && features?.writeUps && admin) },
    { id: "availability", label: "Availability", show: Boolean(enabled && features?.availability) },
    { id: "eligibility", label: "Eligibility", show: Boolean(enabled && features?.eligibility && admin) },
    {
      id: "payroll",
      label: "Payroll",
      show: Boolean(enabled && (features?.payrollSummary || features?.payrollExport) && admin),
    },
  ];

  const visibleTabs = tabs.filter((t) => t.show);
  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === tab)) {
      setTab(visibleTabs[0]?.id ?? "settings");
    }
  }, [tab, visibleTabs]);

  if (isProspectDemo()) {
    return (
      <div className="grid h-full place-items-center p-6 text-sm text-muted-foreground">
        HR is not available on a prospect demo.
      </div>
    );
  }

  if (!orgId || !locationId) {
    return (
      <div className="grid h-full place-items-center p-6 text-sm text-muted-foreground">
        Open a live location to use employment files.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" data-demo="hr">
      <div className="border-b border-border px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <IdCard className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Employment</h2>
          <Badge variant={enabled ? "default" : "outline"}>{enabled ? "HR on" : "HR off"}</Badge>
          {overview?.esign.configured ? (
            <Badge>{overview.esign.provider === "docusign" ? "DocuSign" : "HelloSign"}</Badge>
          ) : (
            <Badge variant="outline">Outbox e-sign</Badge>
          )}
          <GuideLearnLink topicId="hr-employment" compact>
            Learn
          </GuideLearnLink>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Employer of record is this entity (host or operator). Cross-entity files are denied.
          Platform support never sees SSN or full tax packets.
        </p>
        {!isVendor && vendors.length > 0 && (
          <select
            className="mt-2 h-8 rounded-md border border-border bg-bg px-2 text-xs"
            value={employerId}
            onChange={(e) => setEmployerId(e.target.value)}
          >
            <option value={HOST_SCOPE}>{hostName} (host)</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.shortName || v.name}
              </option>
            ))}
          </select>
        )}
        {flash && (
          <p className="mt-2 flex items-center gap-1 text-xs text-danger">
            <AlertTriangle className="h-3 w-3" />
            {flash}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1">
          {visibleTabs.map((t) => (
            <Button
              key={t.id}
              size="sm"
              variant={tab === t.id ? "default" : "outline"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "settings" && overview && (
          <HrSettingsCard
            orgId={orgId}
            locationId={locationId}
            employerId={employerId}
            overview={overview}
            busy={busy}
            onBusy={setBusy}
            onSaved={async () => {
              setFlash("HR settings saved for this employer.");
              await loadOverview();
            }}
            onError={(m) => setFlash(m)}
          />
        )}
        {tab === "applicants" && (
          <ApplicantsPanel scope={scope} staff={staff} onError={setFlash} />
        )}
        {tab === "onboarding" && (
          <OnboardingPanel
            scope={scope}
            staff={staff}
            platform={Boolean(overview?.isPlatformAdmin)}
            piiReady={Boolean(overview?.piiReady)}
            onError={setFlash}
          />
        )}
        {tab === "packets" && overview && (
          <PacketsPanel
            scope={scope}
            staff={staff}
            overview={overview}
            employerName={
              employerId === HOST_SCOPE
                ? hostName
                : vendors.find((v) => v.id === employerId)?.shortName || "Operator"
            }
            locationName={hostName}
            onError={setFlash}
          />
        )}
        {tab === "timeoff" && <TimeOffPanel scope={scope} staff={staff} admin={admin} onError={setFlash} />}
        {tab === "writeups" && <WriteupsPanel scope={scope} staff={staff} onError={setFlash} />}
        {tab === "availability" && (
          <AvailabilityPanel scope={scope} staff={staff} onError={setFlash} />
        )}
        {tab === "eligibility" && <EligibilityPanel scope={scope} staff={staff} onError={setFlash} />}
        {tab === "payroll" && overview && (
          <PayrollPanel
            scope={scope}
            staff={staff}
            features={overview.config.features}
            punches={punches}
            hostName={hostName}
            vendorName={(id) =>
              id === HOST_SCOPE ? hostName : vendors.find((v) => v.id === id)?.shortName ?? id
            }
            onError={setFlash}
          />
        )}
        {!enabled && tab === "settings" && admin && (
          <p className="mt-3 max-w-xl text-xs text-muted-foreground">
            Scheduling and time clock stay available from Labor even while HR is off. Turn on
            Employment for this entity to unlock hiring, packets, time-off, write-ups, and payroll
            reports.
          </p>
        )}
        {!enabled && !admin && (
          <p className="max-w-xl text-sm text-muted-foreground">
            Your employer has not enabled employment modules. Clock in and out on Labor. PIN is
            not a time punch.
          </p>
        )}
      </div>
    </div>
  );
}

export function HrSettingsPack() {
  const orgId = useSaasStore((s) => s.org.id);
  const locationId = usePosStore((s) => s.tenantLocationId) || "";
  const current = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const employerId =
    current?.role === "vendor_operator" ? current.operatorId || HOST_SCOPE : HOST_SCOPE;
  const [overview, setOverview] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!orgId || !locationId || isProspectDemo()) return;
    void hrOverviewFn({ data: { orgId, locationId, employerId } })
      .then(setOverview)
      .catch((e) => setErr(errMsg(e)));
  }, [orgId, locationId, employerId]);
  if (isProspectDemo() || !orgId || !locationId) return null;
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-sm font-semibold">Employment (this employer)</h3>
        <GuideLearnLink topicId="hr-employment" compact>
          Learn
        </GuideLearnLink>
      </div>
      {err && <p className="mb-2 text-xs text-danger">{err}</p>}
      {overview && (
        <HrSettingsCard
          orgId={orgId}
          locationId={locationId}
          employerId={employerId}
          overview={overview}
          onSaved={async () => {
            const o = await hrOverviewFn({ data: { orgId, locationId, employerId } });
            setOverview(o);
          }}
          onError={setErr}
        />
      )}
    </section>
  );
}

export function HrSettingsCard({
  orgId,
  locationId,
  employerId,
  overview,
  busy,
  onBusy,
  onSaved,
  onError,
}: {
  orgId: string;
  locationId: string;
  employerId: string;
  overview: Overview;
  busy?: boolean;
  onBusy?: (v: boolean) => void;
  onSaved: () => void | Promise<void>;
  onError: (m: string) => void;
}) {
  const [enabled, setEnabled] = useState(overview.config.enabled);
  const [state, setState] = useState(overview.config.employmentState || overview.employmentState);
  const [features, setFeatures] = useState(overview.config.features);
  const [visibility, setVisibility] = useState(overview.config.visibility);

  useEffect(() => {
    setEnabled(overview.config.enabled);
    setState(overview.config.employmentState || overview.employmentState);
    setFeatures(overview.config.features);
    setVisibility(overview.config.visibility);
  }, [overview]);

  const save = async () => {
    onBusy?.(true);
    try {
      await saveHrSettingsFn({
        data: {
          orgId,
          locationId,
          employerId,
          enabled,
          employmentState: state,
          features,
          visibility,
        },
      });
      await onSaved();
    } catch (e) {
      onError(errMsg(e));
    } finally {
      onBusy?.(false);
    }
  };

  return (
    <section className="max-w-3xl space-y-4 rounded-2xl border border-border bg-surface p-4">
      <div>
        <h3 className="text-sm font-semibold">Employer flags</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          All modules default off except scheduling and time clock (Labor). Visibility is per
          field. Host sees a tenant’s files only when that tenant chooses Host.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Enable HR for this employer
      </label>
      <label className="block text-sm">
        Employment state
        <select
          className="mt-1 h-9 w-full max-w-xs rounded-md border border-border bg-bg px-2 text-sm"
          value={state}
          onChange={(e) => setState(e.target.value)}
        >
          <option value="federal">Federal only</option>
          {US_STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        {HR_FEATURE_KEYS.map((k) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={features[k]}
              disabled={k === "scheduling" || k === "timeClock"}
              onChange={(e) => setFeatures((f) => ({ ...f, [k]: e.target.checked }))}
            />
            {HR_FEATURE_LABEL[k as HrFeatureKey]}
            {(k === "scheduling" || k === "timeClock") && (
              <span className="text-[10px] text-muted-foreground">Labor</span>
            )}
          </label>
        ))}
      </div>
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Who can view
        </h4>
        <div className="grid gap-2 sm:grid-cols-2">
          {HR_VISIBILITY_KEYS.map((k) => (
            <label key={k} className="block text-sm">
              {HR_VISIBILITY_LABEL[k as HrVisibilityKey]}
              <select
                className="mt-1 h-9 w-full rounded-md border border-border bg-bg px-2 text-sm"
                value={visibility[k]}
                onChange={(e) =>
                  setVisibility((v) => ({ ...v, [k]: e.target.value as HrAudience }))
                }
              >
                {HR_AUDIENCES.map((a) => (
                  <option key={a} value={a}>
                    {HR_AUDIENCE_LABEL[a]}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{overview.esign.label}</p>
      <Button size="sm" disabled={busy} onClick={() => void save()}>
        Save HR settings
      </Button>
    </section>
  );
}

function ApplicantsPanel({
  scope,
  onError,
}: {
  scope: { orgId: string; locationId: string; employerId: string };
  staff: { id: string; name: string }[];
  onError: (m: string) => void;
}) {
  const [rows, setRows] = useState<HrApplicant[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const load = useCallback(async () => {
    try {
      setRows(await listHrApplicantsFn({ data: scope }));
    } catch (e) {
      onError(errMsg(e));
    }
  }, [scope, onError]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="max-w-3xl space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="h-9 max-w-[10rem]" />
        <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 max-w-[12rem]" />
        <Input placeholder="Role" value={role} onChange={(e) => setRole(e.target.value)} className="h-9 max-w-[8rem]" />
        <Button
          size="sm"
          onClick={() => {
            if (!name.trim()) return;
            void upsertHrApplicantFn({
              data: { ...scope, name: name.trim(), email, role, stage: "applied" },
            })
              .then(() => {
                setName("");
                setEmail("");
                setRole("");
                return load();
              })
              .catch((e) => onError(errMsg(e)));
          }}
        >
          Add applicant
        </Button>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
            <span className="font-medium">{r.name}</span>
            <span className="text-xs text-muted-foreground">{r.role || "—"}</span>
            <select
              className="h-8 rounded-md border border-border bg-bg px-2 text-xs"
              value={r.stage}
              onChange={(e) => {
                void upsertHrApplicantFn({
                  data: { ...scope, id: r.id, name: r.name, email: r.email, role: r.role, stage: e.target.value, notes: r.notes },
                })
                  .then(load)
                  .catch((err) => onError(errMsg(err)));
              }}
            >
              {APPLICANT_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </li>
        ))}
        {rows.length === 0 && <p className="text-xs text-muted-foreground">No applicants for this employer.</p>}
      </ul>
    </div>
  );
}

function OnboardingPanel({
  scope,
  staff,
  platform,
  piiReady,
  onError,
}: {
  scope: { orgId: string; locationId: string; employerId: string };
  staff: { id: string; name: string }[];
  platform: boolean;
  piiReady: boolean;
  onError: (m: string) => void;
}) {
  const [rows, setRows] = useState<HrOnboarding[]>([]);
  const [pick, setPick] = useState(staff[0]?.id ?? "");
  const [ssn, setSsn] = useState("");
  const load = useCallback(async () => {
    try {
      setRows(await listHrOnboardingFn({ data: scope }));
    } catch (e) {
      onError(errMsg(e));
    }
  }, [scope, onError]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="max-w-3xl space-y-3">
      <p className="text-xs text-muted-foreground">
        I-9 is dated by section. Section 1 must be completed before Section 2. Do not skip or
        backdate. This is a status file, not a substitute for examining original documents.
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          className="h-9 rounded-md border border-border bg-bg px-2 text-sm"
          value={pick}
          onChange={(e) => setPick(e.target.value)}
        >
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          disabled={!pick}
          onClick={() => {
            const emp = staff.find((s) => s.id === pick);
            if (!emp) return;
            void startHrOnboardingFn({
              data: { ...scope, employeeId: emp.id, employeeName: emp.name },
            })
              .then(load)
              .catch((e) => onError(errMsg(e)));
          }}
        >
          Start checklist
        </Button>
      </div>
      {!platform && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border p-3">
          <label className="text-xs">
            SSN (encrypted; last4 stored for display)
            <Input
              className="mt-1 h-9"
              type="password"
              autoComplete="off"
              value={ssn}
              onChange={(e) => setSsn(e.target.value)}
              placeholder={piiReady ? "•••••••••" : "Last4 only until HR_PII_SECRET is set"}
            />
          </label>
          <Button
            size="sm"
            variant="outline"
            disabled={!pick || !ssn}
            onClick={() => {
              void saveHrPiiFn({ data: { ...scope, employeeId: pick, ssn } })
                .then((r) => {
                  setSsn("");
                  onError(r.error ? r.error : r.last4 ? `Last4 on file: ${r.last4}` : "Saved");
                })
                .catch((e) => onError(errMsg(e)));
            }}
          >
            Store SSN
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!pick}
            onClick={() => {
              void viewHrPiiFn({ data: { ...scope, employeeId: pick } })
                .then((v) =>
                  onError(
                    v.redacted
                      ? "PII redacted for this viewer"
                      : `Last4 ${v.ssnLast4 ?? "none"} · tax ${v.taxOnFile ? "on file" : "missing"}`,
                  ),
                )
                .catch((e) => onError(errMsg(e)));
            }}
          >
            View last4
          </Button>
        </div>
      )}
      {rows.map((r) => (
        <div key={r.id} className="rounded-xl border border-border bg-surface p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{r.employeeName}</span>
            <Badge variant="outline">{r.i9Status}</Badge>
            {r.completedAt && <Badge>Complete</Badge>}
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            {r.checklist.map((c, i) => (
              <li key={c.id}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={c.done}
                    onChange={(e) => {
                      const next = r.checklist.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x));
                      void patchHrOnboardingFn({ data: { ...scope, id: r.id, checklist: next } })
                        .then(load)
                        .catch((err) => onError(errMsg(err)));
                    }}
                  />
                  {c.label}
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void patchHrOnboardingFn({ data: { ...scope, id: r.id, checklist: r.checklist, markI9Section: 1 } })
                  .then(load)
                  .catch((e) => onError(errMsg(e)))
              }
            >
              I-9 §1
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={r.i9Status === "not_started"}
              onClick={() =>
                void patchHrOnboardingFn({ data: { ...scope, id: r.id, checklist: r.checklist, markI9Section: 2 } })
                  .then(load)
                  .catch((e) => onError(errMsg(e)))
              }
            >
              I-9 §2
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void patchHrOnboardingFn({ data: { ...scope, id: r.id, checklist: r.checklist, complete: true } })
                  .then(load)
                  .catch((e) => onError(errMsg(e)))
              }
            >
              Mark complete
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            §1 {r.i9Section1At ?? "—"} · §2 {r.i9Section2At ?? "—"}
            {(r.i9Files ?? []).length
              ? ` · files: ${r.i9Files.map((f) => `§${f.section} ${f.fileName}`).join(", ")}`
              : ""}
          </p>
          <label className="mt-1 inline-flex cursor-pointer items-center text-[11px] text-primary">
            Attach I-9 copy
            <input
              type="file"
              accept="application/pdf,image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const section = r.i9Status === "not_started" ? 1 : r.i9Status === "section1" ? 2 : 2;
                void attachHrI9FileFn({
                  data: {
                    ...scope,
                    id: r.id,
                    section,
                    fileName: file.name,
                    fileKind: file.type || "application/pdf",
                  },
                })
                  .then(load)
                  .catch((err) => onError(errMsg(err)));
              }}
            />
          </label>
        </div>
      ))}
    </div>
  );
}

function PacketsPanel({
  scope,
  staff,
  overview,
  employerName,
  locationName,
  onError,
}: {
  scope: { orgId: string; locationId: string; employerId: string };
  staff: { id: string; name: string }[];
  overview: Overview;
  employerName: string;
  locationName: string;
  onError: (m: string) => void;
}) {
  const [rows, setRows] = useState<HrPacket[]>([]);
  const [pick, setPick] = useState(staff[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [tmpl, setTmpl] = useState(overview.packets[0]?.id ?? "fed_w4");
  const templates = packetsForState(
    overview.employmentState === "federal" ? "US" : overview.employmentState,
  );
  const load = useCallback(async () => {
    try {
      setRows(await listHrPacketsFn({ data: scope }));
    } catch (e) {
      onError(errMsg(e));
    }
  }, [scope, onError]);
  useEffect(() => {
    void load();
  }, [load]);
  const emp = staff.find((s) => s.id === pick);
  return (
    <div className="max-w-3xl space-y-3">
      <p className="text-xs text-muted-foreground">{overview.esign.label}</p>
      <div className="flex flex-wrap gap-2">
        <select
          className="h-9 rounded-md border border-border bg-bg px-2 text-sm"
          value={pick}
          onChange={(e) => setPick(e.target.value)}
        >
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Input
          className="h-9 max-w-[14rem]"
          placeholder="Employee email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select
          className="h-9 max-w-[16rem] rounded-md border border-border bg-bg px-2 text-sm"
          value={tmpl}
          onChange={(e) => setTmpl(e.target.value)}
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          disabled={!emp || !email.includes("@")}
          onClick={() => {
            if (!emp) return;
            void sendHrPacketFn({
              data: {
                ...scope,
                employeeId: emp.id,
                employeeName: emp.name,
                employeeEmail: email,
                templateId: tmpl,
                state: overview.employmentState === "federal" ? "US" : overview.employmentState,
                employerName,
                locationName,
              },
            })
              .then((r) => {
                onError(r.message);
                return load();
              })
              .catch((e) => onError(errMsg(e)));
          }}
        >
          Send packet
        </Button>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{r.title}</span>
              <Badge variant="outline">{r.status}</Badge>
              <span className="text-xs text-muted-foreground">{r.employeeName}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {(r.status === "awaiting_upload" || r.status === "sent" || r.status === "draft") && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void hrPacketOutboxFn({ data: { ...scope, id: r.id } })
                      .then((p) => {
                        const blob = new Blob([p.body || p.title], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${p.title.replace(/[^\w.-]+/g, "-")}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      })
                      .catch((e) => onError(errMsg(e)));
                  }}
                >
                  Download to sign
                </Button>
              )}
              {(r.status === "awaiting_upload" || r.status === "sent" || r.status === "viewed") && (
                <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-border px-2 text-xs">
                  Attach signed PDF
                  <input
                    type="file"
                    accept="application/pdf"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      if (file.size > 280_000) {
                        onError("Signed PDF must be under 280 KB");
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        const fileData = typeof reader.result === "string" ? reader.result : "";
                        void markHrPacketFn({
                          data: {
                            ...scope,
                            id: r.id,
                            action: "upload",
                            fileName: file.name,
                            fileKind: file.type || "application/pdf",
                            fileData,
                          },
                        })
                          .then(load)
                          .catch((err) => onError(errMsg(err)));
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              )}
              {r.hasFile && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void hrPacketFileFn({ data: { ...scope, id: r.id } })
                      .then((f) => {
                        if (!f?.fileData) {
                          onError("No signed file stored");
                          return;
                        }
                        const a = document.createElement("a");
                        a.href = f.fileData;
                        a.download = f.fileName;
                        a.click();
                      })
                      .catch((e) => onError(errMsg(e)));
                  }}
                >
                  Download signed
                </Button>
              )}
              {(r.status === "sent" || r.status === "viewed") && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void markHrPacketFn({ data: { ...scope, id: r.id, action: "signed" } })
                      .then(load)
                      .catch((e) => onError(errMsg(e)))
                  }
                >
                  Mark signed
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void markHrPacketFn({ data: { ...scope, id: r.id, action: "counter_sign" } })
                    .then(load)
                    .catch((e) => onError(errMsg(e)))
                }
              >
                Employer counter-sign
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TimeOffPanel({
  scope,
  staff,
  admin,
  onError,
}: {
  scope: { orgId: string; locationId: string; employerId: string };
  staff: { id: string; name: string }[];
  admin: boolean;
  onError: (m: string) => void;
}) {
  const [rows, setRows] = useState<HrTimeOff[]>([]);
  const [pick, setPick] = useState(staff[0]?.id ?? "");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const load = useCallback(async () => {
    try {
      setRows(await listHrTimeOffFn({ data: scope }));
    } catch (e) {
      onError(errMsg(e));
    }
  }, [scope, onError]);
  useEffect(() => {
    void load();
  }, [load]);
  const emp = staff.find((s) => s.id === pick);
  return (
    <div className="max-w-3xl space-y-3">
      <div className="flex flex-wrap gap-2">
        <select
          className="h-9 rounded-md border border-border bg-bg px-2 text-sm"
          value={pick}
          onChange={(e) => setPick(e.target.value)}
        >
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Input type="date" className="h-9 w-auto" value={start} onChange={(e) => setStart(e.target.value)} />
        <Input type="date" className="h-9 w-auto" value={end} onChange={(e) => setEnd(e.target.value)} />
        <Button
          size="sm"
          disabled={!emp || !start || !end}
          onClick={() => {
            if (!emp) return;
            void upsertHrTimeOffFn({
              data: {
                ...scope,
                employeeId: emp.id,
                employeeName: emp.name,
                kind: "pto",
                startAt: new Date(start).toISOString(),
                endAt: new Date(end).toISOString(),
              },
            })
              .then(load)
              .catch((e) => onError(errMsg(e)));
          }}
        >
          Request
        </Button>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
            <span className="font-medium">{r.employeeName}</span>
            <span className="text-xs text-muted-foreground">
              {r.startAt.slice(0, 10)} → {r.endAt.slice(0, 10)}
            </span>
            <Badge variant="outline">{r.status}</Badge>
            {admin && r.status === "requested" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void upsertHrTimeOffFn({
                      data: {
                        ...scope,
                        id: r.id,
                        employeeId: r.employeeId,
                        employeeName: r.employeeName,
                        kind: r.kind,
                        startAt: r.startAt,
                        endAt: r.endAt,
                        status: "approved",
                      },
                    })
                      .then(load)
                      .catch((e) => onError(errMsg(e)))
                  }
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void upsertHrTimeOffFn({
                      data: {
                        ...scope,
                        id: r.id,
                        employeeId: r.employeeId,
                        employeeName: r.employeeName,
                        kind: r.kind,
                        startAt: r.startAt,
                        endAt: r.endAt,
                        status: "denied",
                      },
                    })
                      .then(load)
                      .catch((e) => onError(errMsg(e)))
                  }
                >
                  Deny
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function WriteupsPanel({
  scope,
  staff,
  onError,
}: {
  scope: { orgId: string; locationId: string; employerId: string };
  staff: { id: string; name: string }[];
  onError: (m: string) => void;
}) {
  const [rows, setRows] = useState<HrWriteup[]>([]);
  const [pick, setPick] = useState(staff[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const load = useCallback(async () => {
    try {
      setRows(await listHrWriteupsFn({ data: scope }));
    } catch (e) {
      onError(errMsg(e));
    }
  }, [scope, onError]);
  useEffect(() => {
    void load();
  }, [load]);
  const emp = staff.find((s) => s.id === pick);
  return (
    <div className="max-w-3xl space-y-3">
      <p className="text-xs text-muted-foreground">
        Visibility follows this employer’s write-up setting. Platform support sees a redacted body.
      </p>
      <div className="grid gap-2">
        <select
          className="h-9 max-w-xs rounded-md border border-border bg-bg px-2 text-sm"
          value={pick}
          onChange={(e) => setPick(e.target.value)}
        >
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea
          className="min-h-24 rounded-md border border-border bg-bg p-2 text-sm"
          placeholder="Incident"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <Button
          size="sm"
          className="w-fit"
          disabled={!emp || !title.trim() || !body.trim()}
          onClick={() => {
            if (!emp) return;
            void addHrWriteupFn({
              data: {
                ...scope,
                employeeId: emp.id,
                employeeName: emp.name,
                title: title.trim(),
                body: body.trim(),
                severity: "written",
              },
            })
              .then(() => {
                setTitle("");
                setBody("");
                return load();
              })
              .catch((e) => onError(errMsg(e)));
          }}
        >
          File write-up
        </Button>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
            <div className="flex gap-2">
              <span className="font-medium">{r.title}</span>
              <Badge variant="outline">{r.severity}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{r.employeeName}</p>
            <p className="mt-1 text-sm">{r.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function AvailabilityPanel({
  scope,
  staff,
  onError,
}: {
  scope: { orgId: string; locationId: string; employerId: string };
  staff: { id: string; name: string }[];
  onError: (m: string) => void;
}) {
  const [pick, setPick] = useState(staff[0]?.id ?? "");
  const [rows, setRows] = useState<HrAvailability[]>([]);
  const load = useCallback(async () => {
    if (!pick) return;
    try {
      setRows(await listHrAvailabilityFn({ data: { ...scope, employeeId: pick } }));
    } catch (e) {
      onError(errMsg(e));
    }
  }, [scope, pick, onError]);
  useEffect(() => {
    void load();
  }, [load]);
  const byDay = (d: number) => rows.find((r) => r.weekday === d);
  return (
    <div className="max-w-3xl space-y-3">
      <p className="text-xs text-muted-foreground">
        Entity staff only. Windows are local minutes from midnight. Scheduling still lives on Labor.
      </p>
      <select
        className="h-9 rounded-md border border-border bg-bg px-2 text-sm"
        value={pick}
        onChange={(e) => setPick(e.target.value)}
      >
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <ul className="space-y-2" key={pick}>
        {WEEKDAYS.map((label, d) => {
          const row = byDay(d);
          const start = row ? String(Math.floor(row.startMin / 60)).padStart(2, "0") + ":" + String(row.startMin % 60).padStart(2, "0") : "09:00";
          const end = row ? String(Math.floor(row.endMin / 60)).padStart(2, "0") + ":" + String(row.endMin % 60).padStart(2, "0") : "17:00";
          return (
            <li key={d} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
              <span className="w-10 font-medium">{label}</span>
              <Input
                type="time"
                className="h-8 w-28"
                defaultValue={start}
                id={`av-s-${pick}-${d}`}
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="time"
                className="h-8 w-28"
                defaultValue={end}
                id={`av-e-${pick}-${d}`}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!pick}
                onClick={() => {
                  const sEl = document.getElementById(`av-s-${pick}-${d}`) as HTMLInputElement | null;
                  const eEl = document.getElementById(`av-e-${pick}-${d}`) as HTMLInputElement | null;
                  const parse = (v: string, fallback: number) => {
                    const [h, m] = (v || "").split(":").map(Number);
                    if (Number.isFinite(h) && Number.isFinite(m)) return h * 60 + m;
                    return fallback;
                  };
                  const next = WEEKDAYS.map((_, i) => {
                    const existing = byDay(i);
                    if (i !== d) {
                      return existing
                        ? { weekday: i, startMin: existing.startMin, endMin: existing.endMin }
                        : null;
                    }
                    return {
                      weekday: d,
                      startMin: parse(sEl?.value ?? start, 9 * 60),
                      endMin: parse(eEl?.value ?? end, 17 * 60),
                    };
                  }).filter((x): x is { weekday: number; startMin: number; endMin: number } => Boolean(x));
                  void setHrAvailabilityFn({ data: { ...scope, employeeId: pick, rows: next } })
                    .then(load)
                    .catch((e) => onError(errMsg(e)));
                }}
              >
                Save
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EligibilityPanel({
  scope,
  staff,
  onError,
}: {
  scope: { orgId: string; locationId: string; employerId: string };
  staff: { id: string; name: string }[];
  onError: (m: string) => void;
}) {
  const [rows, setRows] = useState<HrEligibility[]>([]);
  const load = useCallback(async () => {
    try {
      setRows(await listHrEligibilityFn({ data: scope }));
    } catch (e) {
      onError(errMsg(e));
    }
  }, [scope, onError]);
  useEffect(() => {
    void load();
  }, [load]);
  const byId = new Map(rows.map((r) => [r.employeeId, r]));
  return (
    <div className="max-w-3xl space-y-2">
      <p className="text-xs text-muted-foreground">
        Minor and alcohol-service flags are operational, not legal advice. Keep them current for
        this employer’s staff only.
      </p>
      {staff.map((s) => {
        const row = byId.get(s.id) ?? { employeeId: s.id, minor: false, alcohol: false, notes: "" };
        return (
          <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
            <span className="w-36 font-medium">{s.name}</span>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={row.minor}
                onChange={(e) =>
                  void setHrEligibilityFn({
                    data: { ...scope, employeeId: s.id, minor: e.target.checked, alcohol: row.alcohol },
                  })
                    .then(load)
                    .catch((err) => onError(errMsg(err)))
                }
              />
              Minor
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={row.alcohol}
                onChange={(e) =>
                  void setHrEligibilityFn({
                    data: { ...scope, employeeId: s.id, minor: row.minor, alcohol: e.target.checked },
                  })
                    .then(load)
                    .catch((err) => onError(errMsg(err)))
                }
              />
              Alcohol service OK
            </label>
          </div>
        );
      })}
    </div>
  );
}

function PayrollPanel({
  scope,
  staff,
  features,
  punches,
  hostName,
  vendorName,
  onError,
}: {
  scope: { orgId: string; locationId: string; employerId: string };
  staff: { id: string; name: string }[];
  features: EntityHrConfig["features"];
  punches: import("@/lib/pos/ops-types").TimePunch[];
  hostName: string;
  vendorName: (id: string) => string;
  onError: (m: string) => void;
}) {
  const employees = usePosStore((s) => s.employees);
  const [note, setNote] = useState<string | null>(null);
  const [shiftHours, setShiftHours] = useState<
    { employeeId: string; employeeName?: string; scheduledHours: number; punchHours?: number; otHours?: number; shiftCount: number; punchCount?: number }[]
  >([]);
  const [serverCsv, setServerCsv] = useState<string>("");
  useEffect(() => {
    void hrPayrollSummaryFn({ data: scope })
      .then((r) => {
        setShiftHours(r.rows);
        setNote(r.note);
        setServerCsv(r.csv);
      })
      .catch((e) => onError(errMsg(e)));
  }, [scope, onError]);
  const laborRows = buildPayrollRows({
    punches,
    employees: employees.filter((e) => staff.some((s) => s.id === e.id)),
    operatorName: vendorName,
    operatorId: scope.employerId,
  });
  const download = () => {
    const body = serverCsv || payrollCsv(laborRows);
    const blob = new Blob([body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-${scope.employerId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="max-w-3xl space-y-3">
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      {features.payrollSummary && (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="py-1">Staff</th>
              <th>Hours</th>
              <th>OT</th>
              <th>Tips</th>
              <th>Shifts</th>
            </tr>
          </thead>
          <tbody>
            {laborRows.map((r) => {
              const sh = shiftHours.find((x) => x.employeeId === r.employeeId);
              return (
                <tr key={r.employeeId} className="border-t border-border">
                  <td className="py-1">{r.name}</td>
                  <td>{(sh?.punchHours ?? r.regularHours).toFixed(2)}</td>
                  <td>{(sh?.otHours ?? r.otHours).toFixed(2)}</td>
                  <td>{formatCurrency(r.tipsCents)}</td>
                  <td>{sh?.punchCount ?? sh?.shiftCount ?? r.punchCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {features.payrollExport && (
        <Button size="sm" variant="outline" onClick={download}>
          Download hours/tips CSV
        </Button>
      )}
      <p className="text-[11px] text-muted-foreground">
        {hostName} · entity {scope.employerId}. Not a withholding or tax-filing engine.
      </p>
    </div>
  );
}
