import { useEffect, useMemo, useState } from "react";
import { toast, Toaster } from "sonner";
import {
  AlertTriangle,
  CreditCard,
  Database,
  Flag,
  Globe,
  Mail,
  Shield,
  SlidersHorizontal,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { factoryResetFn, factoryResetStatusFn } from "@/lib/saas/crm-api";
import {
  invitePlatformUserFn,
  loadPlatformSettingsFn,
  savePlatformPlansFn,
  savePlatformSectionFn,
  updatePlatformUserFn,
} from "@/lib/saas/platform-settings-api";
import {
  CURRENCIES,
  GIFT_ISSUER_MODES,
  GIFT_RESIDUAL_MODES,
  INVITE_TOKENS,
  QUOTE_EMAIL_TOKENS,
  TENANT_EMAIL_TOKENS,
  MODULE_FLAG_KEYS,
  MODULE_FLAG_LABEL,
  NETWORK_READY_MODES,
  PAYMENTS_MODES,
  PIN_LENGTHS,
  PLATFORM_TEAM_ROLES,
  SETTINGS_SECTION_LABEL,
  SETTINGS_SECTIONS,
  TIMEZONES,
  WAITLIST_TOKENS,
  formatMoneyCents,
  newLocalId,
  parseMoneyToCents,
  type BillingSettings,
  type CommunicationsSettings,
  type ComplianceSettings,
  type CrmSettings,
  type FeatureFlagSettings,
  type GeneralSettings,
  type ModuleFlags,
  type OnboardingSettings,
  type PaymentsSettings,
  type PlanEditorRow,
  type PlatformTeamMember,
  type PlatformTeamRole,
  type SecuritySettings,
  type SettingsBundle,
  type SettingsSectionId,
  type EmailOutboxRow,
} from "@/lib/saas/platform-settings";
import { signOut } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import {
  ChipList,
  Field,
  NumberField,
  OrderedRows,
  SectionCard,
  SelectField,
  StatusPill,
  TokenChips,
  ToggleRow,
} from "./settings-fields";

const ICONS: Record<SettingsSectionId, typeof Globe> = {
  general: Globe,
  security: Shield,
  crm: Users,
  onboarding: SlidersHorizontal,
  billing: CreditCard,
  payments: Wallet,
  communications: Mail,
  flags: Flag,
  compliance: Database,
  team: UserCog,
  danger: AlertTriangle,
};

function clearLocalAppData() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k?.startsWith("summex-")) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Save failed";
}

export function SettingsWorkspace() {
  const [section, setSection] = useState<SettingsSectionId>("general");
  const [bundle, setBundle] = useState<SettingsBundle | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = () => {
    void loadPlatformSettingsFn()
      .then(setBundle)
      .catch((e) => setLoadErr(errMessage(e)));
  };

  useEffect(() => {
    reload();
  }, []);

  if (loadErr && !bundle) {
    return <p className="p-4 text-sm text-danger">{loadErr}</p>;
  }
  if (!bundle) {
    return <p className="p-4 text-sm text-muted-foreground">Loading settings…</p>;
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <Toaster position="top-center" richColors />
      <nav className="hidden w-52 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border bg-surface p-2 md:flex">
        <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Settings
        </p>
        {SETTINGS_SECTIONS.map((id) => {
          const Icon = ICONS[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={cn(
                "flex h-10 items-center gap-2 rounded-lg px-2 text-left text-sm",
                section === id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                id === "danger" && section !== id && "text-danger",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {SETTINGS_SECTION_LABEL[id]}
            </button>
          );
        })}
      </nav>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Platform settings</h2>
          <GuideLearnLink topicId="platform-settings" compact>
            Learn
          </GuideLearnLink>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2 md:hidden">
          {SETTINGS_SECTIONS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={cn(
                "h-9 shrink-0 rounded-lg px-3 text-xs font-medium",
                section === id
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground",
              )}
            >
              {SETTINGS_SECTION_LABEL[id]}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {section === "general" && (
            <GeneralSection
              initial={bundle.general}
              meta={bundle.meta}
              saving={saving}
              onSave={async (value) => {
                setSaving(true);
                try {
                  const next = await savePlatformSectionFn({ data: { section: "general", value } });
                  setBundle(next);
                  toast.success("General settings saved");
                } catch (e) {
                  toast.error(errMessage(e));
                } finally {
                  setSaving(false);
                }
              }}
            />
          )}
          {section === "security" && (
            <SecuritySection
              initial={bundle.security}
              saving={saving}
              onSave={async (value) => {
                setSaving(true);
                try {
                  const next = await savePlatformSectionFn({ data: { section: "security", value } });
                  setBundle(next);
                  toast.success("Security settings saved");
                } catch (e) {
                  toast.error(errMessage(e));
                } finally {
                  setSaving(false);
                }
              }}
            />
          )}
          {section === "crm" && (
            <CrmSection
              initial={bundle.crm}
              team={bundle.team}
              saving={saving}
              onSave={async (value) => {
                setSaving(true);
                try {
                  const next = await savePlatformSectionFn({ data: { section: "crm", value } });
                  setBundle(next);
                  toast.success("CRM settings saved");
                } catch (e) {
                  toast.error(errMessage(e));
                } finally {
                  setSaving(false);
                }
              }}
            />
          )}
          {section === "onboarding" && (
            <OnboardingSection
              initial={bundle.onboarding}
              plans={bundle.plans}
              saving={saving}
              onSave={async (value) => {
                setSaving(true);
                try {
                  const next = await savePlatformSectionFn({
                    data: { section: "onboarding", value },
                  });
                  setBundle(next);
                  toast.success("Onboarding settings saved");
                } catch (e) {
                  toast.error(errMessage(e));
                } finally {
                  setSaving(false);
                }
              }}
            />
          )}
          {section === "billing" && (
            <BillingSection
              plans={bundle.plans}
              billing={bundle.billing}
              stripeConnected={bundle.meta.stripeConnected}
              saving={saving}
              onSave={async (plans, billing) => {
                setSaving(true);
                try {
                  const next = await savePlatformPlansFn({ data: { plans, billing } });
                  setBundle(next);
                  toast.success("Plans & billing saved");
                } catch (e) {
                  toast.error(errMessage(e));
                } finally {
                  setSaving(false);
                }
              }}
            />
          )}
          {section === "payments" && (
            <PaymentsSection
              initial={bundle.payments}
              saving={saving}
              onSave={async (value) => {
                setSaving(true);
                try {
                  const next = await savePlatformSectionFn({
                    data: { section: "payments", value },
                  });
                  setBundle(next);
                  toast.success("Payments & gift defaults saved");
                } catch (e) {
                  toast.error(errMessage(e));
                } finally {
                  setSaving(false);
                }
              }}
            />
          )}
          {section === "communications" && (
            <CommunicationsSection
              initial={bundle.communications}
              sms={bundle.meta.smsConfigured}
              email={bundle.meta.emailConfigured}
              outbox={bundle.emailOutbox ?? []}
              saving={saving}
              onSave={async (value) => {
                setSaving(true);
                try {
                  const next = await savePlatformSectionFn({
                    data: { section: "communications", value },
                  });
                  setBundle(next);
                  toast.success("Communications saved");
                } catch (e) {
                  toast.error(errMessage(e));
                } finally {
                  setSaving(false);
                }
              }}
            />
          )}
          {section === "flags" && (
            <FlagsSection
              initial={bundle.flags}
              saving={saving}
              onSave={async (value) => {
                setSaving(true);
                try {
                  const next = await savePlatformSectionFn({ data: { section: "flags", value } });
                  setBundle(next);
                  toast.success("Feature flags saved");
                } catch (e) {
                  toast.error(errMessage(e));
                } finally {
                  setSaving(false);
                }
              }}
            />
          )}
          {section === "compliance" && (
            <ComplianceSection
              initial={bundle.compliance}
              saving={saving}
              onSave={async (value) => {
                setSaving(true);
                try {
                  const next = await savePlatformSectionFn({
                    data: { section: "compliance", value },
                  });
                  setBundle(next);
                  toast.success("Data & compliance saved");
                } catch (e) {
                  toast.error(errMessage(e));
                } finally {
                  setSaving(false);
                }
              }}
            />
          )}
          {section === "team" && (
            <TeamSection
              team={bundle.team}
              onChanged={(next) => setBundle(next)}
            />
          )}
          {section === "danger" && (
            <DangerSection
              factoryResetEnabled={bundle.security.factoryResetEnabled}
              envEnabled={bundle.meta.factoryResetEnvEnabled}
              envReason={bundle.meta.factoryResetEnvReason}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function GeneralSection({
  initial,
  meta,
  saving,
  onSave,
}: {
  initial: GeneralSettings;
  meta: SettingsBundle["meta"];
  saving: boolean;
  onSave: (v: GeneralSettings) => Promise<void>;
}) {
  const [v, setV] = useState(initial);
  useEffect(() => setV(initial), [initial]);
  return (
    <SectionCard
      title="General"
      description="How Summex identifies itself to operators and guests. Powered by Quantum Reach."
      saving={saving}
      onSave={() => onSave(v)}
    >
      <Field label="Platform display name">
        <Input value={v.displayName} onChange={(e) => setV({ ...v, displayName: e.target.value })} />
      </Field>
      <Field label="Support email">
        <Input
          type="email"
          value={v.supportEmail}
          onChange={(e) => setV({ ...v, supportEmail: e.target.value })}
        />
      </Field>
      <Field label="Support phone">
        <Input value={v.supportPhone} onChange={(e) => setV({ ...v, supportPhone: e.target.value })} />
      </Field>
      <Field label="Default timezone">
        <SelectField value={v.timezone} onChange={(timezone) => setV({ ...v, timezone: timezone as GeneralSettings["timezone"] })}>
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replaceAll("_", " ")}
            </option>
          ))}
        </SelectField>
      </Field>
      <Field label="Default currency">
        <SelectField value={v.currency} onChange={(currency) => setV({ ...v, currency: currency as GeneralSettings["currency"] })}>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>
      </Field>
      <Field
        label="Public marketing URL"
        hint={meta.marketingUrlFromEnv ? `Environment default: ${meta.marketingUrlFromEnv}` : "Shown on quotes and invites."}
      >
        <Input
          value={v.marketingUrl}
          placeholder={meta.marketingUrlFromEnv || "https://summex.app"}
          onChange={(e) => setV({ ...v, marketingUrl: e.target.value })}
        />
      </Field>
      <Field label="App URL" hint="Read-only from the deployed environment. Used for invites and POS links.">
        <Input value={meta.appUrl} readOnly className="opacity-80" />
      </Field>
    </SectionCard>
  );
}

function SecuritySection({
  initial,
  saving,
  onSave,
}: {
  initial: SecuritySettings;
  saving: boolean;
  onSave: (v: SecuritySettings) => Promise<void>;
}) {
  const [v, setV] = useState(initial);
  useEffect(() => setV(initial), [initial]);
  return (
    <SectionCard
      title="Security & auth"
      description="Password, session, and floor PIN policy. Aligns with Admin first-login bootstrap."
      saving={saving}
      onSave={() => onSave(v)}
    >
      <Field label="Minimum password length">
        <NumberField value={v.minPasswordLength} min={8} max={64} onChange={(n) => setV({ ...v, minPasswordLength: n })} />
      </Field>
      <Field label="Session idle timeout (minutes)">
        <NumberField
          value={v.sessionIdleTimeoutMinutes}
          min={5}
          max={1440}
          onChange={(n) => setV({ ...v, sessionIdleTimeoutMinutes: n })}
        />
      </Field>
      <Field label="Floor PIN length">
        <SelectField
          value={String(v.pinLength)}
          onChange={(s) => setV({ ...v, pinLength: Number(s) as SecuritySettings["pinLength"] })}
        >
          {PIN_LENGTHS.map((n) => (
            <option key={n} value={n}>
              {n} digits{n === 4 ? " (default)" : ""}
            </option>
          ))}
        </SelectField>
      </Field>
      <Field label="PIN max failed attempts before lockout">
        <NumberField
          value={v.pinMaxFailedAttempts}
          min={1}
          max={20}
          onChange={(n) => setV({ ...v, pinMaxFailedAttempts: n })}
        />
      </Field>
      <Field label="PIN lockout (minutes)">
        <NumberField value={v.pinLockoutMinutes} min={1} max={1440} onChange={(n) => setV({ ...v, pinLockoutMinutes: n })} />
      </Field>
      <ToggleRow
        label="Require Admin password change on first login"
        hint="Matches bootstrap and factory-reset reseeding."
        checked={v.requireAdminPasswordChangeOnFirstLogin}
        onChange={(requireAdminPasswordChangeOnFirstLogin) =>
          setV({ ...v, requireAdminPasswordChangeOnFirstLogin })
        }
      />
      <ToggleRow
        label="Factory reset enabled"
        hint="When off, the Danger zone action is hidden even if the environment allows it."
        checked={v.factoryResetEnabled}
        onChange={(factoryResetEnabled) => setV({ ...v, factoryResetEnabled })}
      />
    </SectionCard>
  );
}

function CrmSection({
  initial,
  team,
  saving,
  onSave,
}: {
  initial: CrmSettings;
  team: PlatformTeamMember[];
  saving: boolean;
  onSave: (v: CrmSettings) => Promise<void>;
}) {
  const [v, setV] = useState(initial);
  useEffect(() => setV(initial), [initial]);
  const owners = team.filter((t) => t.status === "active");
  return (
    <SectionCard
      title="CRM & pipeline"
      description="Default lead sources and stages for new accounts. Not a JSON blob — add, remove, and reorder here."
      saving={saving}
      onSave={() => onSave(v)}
    >
      <Field label="Default lead sources">
        <ChipList values={v.leadSources} onChange={(leadSources) => setV({ ...v, leadSources })} placeholder="Add a source" />
      </Field>
      <Field label="Default pipeline stages">
        <OrderedRows
          rows={v.pipelineStages}
          onChange={(pipelineStages) => setV({ ...v, pipelineStages })}
          addLabel="Add stage"
          onAdd={() =>
            setV({
              ...v,
              pipelineStages: [
                ...v.pipelineStages,
                { id: newLocalId("stage"), label: "New stage" },
              ],
            })
          }
          render={(row, i) => (
            <Input
              value={row.label}
              onChange={(e) => {
                const pipelineStages = v.pipelineStages.map((s, j) =>
                  j === i ? { ...s, label: e.target.value } : s,
                );
                setV({ ...v, pipelineStages });
              }}
            />
          )}
        />
      </Field>
      <Field label="Default deal owner">
        <SelectField
          value={v.defaultDealOwnerUserId ?? ""}
          onChange={(id) => setV({ ...v, defaultDealOwnerUserId: id || null })}
        >
          <option value="">Unassigned</option>
          {owners.map((u) => (
            <option key={u.userId} value={u.userId}>
              {u.name} ({u.email})
            </option>
          ))}
        </SelectField>
      </Field>
      <ToggleRow
        label="Require next activity when stage is Qualified"
        hint="Moving an account to Qualified needs an open follow-up with a due date."
        checked={v.requireNextActivityWhenQualified}
        onChange={(requireNextActivityWhenQualified) =>
          setV({ ...v, requireNextActivityWhenQualified })
        }
      />
    </SectionCard>
  );
}

function OnboardingSection({
  initial,
  plans,
  saving,
  onSave,
}: {
  initial: OnboardingSettings;
  plans: PlanEditorRow[];
  saving: boolean;
  onSave: (v: OnboardingSettings) => Promise<void>;
}) {
  const [v, setV] = useState(initial);
  useEffect(() => setV(initial), [initial]);
  return (
    <SectionCard
      title="Onboarding"
      description="Checklist template and go-live defaults for new live orgs."
      saving={saving}
      onSave={() => onSave(v)}
    >
      <Field label="Checklist template">
        <OrderedRows
          rows={v.checklist}
          onChange={(checklist) => setV({ ...v, checklist })}
          addLabel="Add step"
          onAdd={() =>
            setV({
              ...v,
              checklist: [
                ...v.checklist,
                { id: newLocalId("step"), label: "New step", required: false },
              ],
            })
          }
          render={(row, i) => (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="min-w-40 flex-1"
                value={row.label}
                onChange={(e) => {
                  const checklist = v.checklist.map((s, j) =>
                    j === i ? { ...s, label: e.target.value } : s,
                  );
                  setV({ ...v, checklist });
                }}
              />
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  checked={row.required}
                  onChange={(e) => {
                    const checklist = v.checklist.map((s, j) =>
                      j === i ? { ...s, required: e.target.checked } : s,
                    );
                    setV({ ...v, checklist });
                  }}
                />
                Required
              </label>
            </div>
          )}
        />
      </Field>
      <Field label="Network readiness mode" hint="Warn only is the default. Hard-block is not enabled.">
        <SelectField
          value={v.networkReadinessMode}
          onChange={(networkReadinessMode) =>
            setV({ ...v, networkReadinessMode: networkReadinessMode as OnboardingSettings["networkReadinessMode"] })
          }
        >
          {NETWORK_READY_MODES.map((m) => (
            <option key={m} value={m}>
              {m === "warn_only" ? "Warn only (default)" : "Off"}
            </option>
          ))}
        </SelectField>
      </Field>
      <Field label="Default package for new live orgs">
        <SelectField
          value={v.defaultPlanSlug}
          onChange={(defaultPlanSlug) =>
            setV({ ...v, defaultPlanSlug: defaultPlanSlug as OnboardingSettings["defaultPlanSlug"] })
          }
        >
          {plans.filter((p) => p.active).map((p) => (
            <option key={p.id} value={p.slug}>
              {p.name}
            </option>
          ))}
        </SelectField>
      </Field>
      <ToggleRow
        label="Auto-email owner invite on go-live"
        checked={v.autoEmailOwnerInviteOnGoLive}
        onChange={(autoEmailOwnerInviteOnGoLive) => setV({ ...v, autoEmailOwnerInviteOnGoLive })}
      />
      <Field label="Tenant invite expiry (days)" hint="Operator self-serve links expire after this many days. Default 14.">
        <NumberField
          value={v.tenantInviteExpiryDays}
          min={1}
          max={90}
          onChange={(tenantInviteExpiryDays) => setV({ ...v, tenantInviteExpiryDays })}
        />
      </Field>
    </SectionCard>
  );
}

function BillingSection({
  plans: initialPlans,
  billing: initialBilling,
  stripeConnected,
  saving,
  onSave,
}: {
  plans: PlanEditorRow[];
  billing: BillingSettings;
  stripeConnected: boolean;
  saving: boolean;
  onSave: (plans: PlanEditorRow[], billing: BillingSettings) => Promise<void>;
}) {
  const [plans, setPlans] = useState(initialPlans);
  const [billing, setBilling] = useState(initialBilling);
  useEffect(() => {
    setPlans(initialPlans);
    setBilling(initialBilling);
  }, [initialPlans, initialBilling]);

  const setPlan = (id: string, patch: Partial<PlanEditorRow>) => {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };
  const setModule = (id: string, key: keyof ModuleFlags, on: boolean) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === id ? { ...p, modules: { ...p.modules, [key]: on } } : p)),
    );
  };

  return (
    <SectionCard
      title="Plans & billing"
      description="Software subscription catalog. Guest cards stay on Quantum Payments. No JSON editor."
      saving={saving}
      onSave={() => onSave(plans, billing)}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Stripe</span>
        <StatusPill
          ok={stripeConnected}
          okLabel="Connected"
          offLabel="Not configured"
        />
        <span className="text-xs text-muted-foreground">Secret keys stay in the environment — never in this UI.</span>
      </div>
      {plans.map((plan) => (
        <div key={plan.id} className="space-y-3 rounded-xl border border-border bg-bg p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{plan.name}</p>
            <span className="rounded-full border border-border px-2 py-0.5 font-mono text-xs text-muted-foreground">
              {plan.slug}
            </span>
            <div className="ml-auto">
              <ToggleRow
                label="Active"
                checked={plan.active}
                onChange={(active) => setPlan(plan.id, { active })}
              />
            </div>
          </div>
          <Field label="Plan name">
            <Input value={plan.name} onChange={(e) => setPlan(plan.id, { name: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Monthly price per location">
              <Input
                inputMode="decimal"
                value={formatMoneyCents(plan.monthlyCents)}
                onChange={(e) => setPlan(plan.id, { monthlyCents: parseMoneyToCents(e.target.value) })}
              />
            </Field>
            <Field label="Onboarding fee (one-time)">
              <Input
                inputMode="decimal"
                value={formatMoneyCents(plan.onboardingFeeCents)}
                onChange={(e) =>
                  setPlan(plan.id, { onboardingFeeCents: parseMoneyToCents(e.target.value) })
                }
              />
            </Field>
            <Field label="Included locations">
              <NumberField
                value={plan.maxLocations}
                min={1}
                max={9999}
                onChange={(maxLocations) => setPlan(plan.id, { maxLocations })}
              />
            </Field>
            <Field label="Included seats">
              <NumberField
                value={plan.maxSeats}
                min={1}
                max={99999}
                onChange={(maxSeats) => setPlan(plan.id, { maxSeats })}
              />
            </Field>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Modules</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {MODULE_FLAG_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  checked={plan.modules[key]}
                  onChange={(e) => setModule(plan.id, key, e.target.checked)}
                />
                {MODULE_FLAG_LABEL[key]}
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Trial days">
          <NumberField
            value={billing.trialDays}
            min={0}
            max={365}
            onChange={(trialDays) => setBilling({ ...billing, trialDays })}
          />
        </Field>
        <Field label="Failed-payment grace days">
          <NumberField
            value={billing.failedPaymentGraceDays}
            min={0}
            max={90}
            onChange={(failedPaymentGraceDays) => setBilling({ ...billing, failedPaymentGraceDays })}
          />
        </Field>
      </div>
      <ToggleRow
        label="Suspend on lapsed payment"
        hint="After grace days. Software access only — never Quantum Payments settlement."
        checked={billing.suspendOnLapsedPayment}
        onChange={(suspendOnLapsedPayment) => setBilling({ ...billing, suspendOnLapsedPayment })}
      />
      {billing.suspendOnLapsedPayment && (
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-muted-foreground">What suspends</span>
          {(["pos", "back_office"] as const).map((t) => (
            <label key={t} className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={billing.suspendAffects.includes(t)}
                onChange={(e) => {
                  const set = new Set(billing.suspendAffects);
                  if (e.target.checked) set.add(t);
                  else set.delete(t);
                  const suspendAffects = [...set];
                  setBilling({
                    ...billing,
                    suspendAffects: suspendAffects.length ? suspendAffects : ["back_office"],
                  });
                }}
              />
              {t === "pos" ? "POS" : "Back office"}
            </label>
          ))}
        </div>
      )}
      <p className="pt-2 text-sm font-medium">Quote catalog add-ons</p>
      <p className="text-xs text-muted-foreground">
        Used when generating intake quotes. Edited here as numbers — never as JSON.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Per-location fee">
          <Input
            inputMode="decimal"
            value={formatMoneyCents(billing.perLocationFeeCents)}
            onChange={(e) =>
              setBilling({ ...billing, perLocationFeeCents: parseMoneyToCents(e.target.value) })
            }
          />
        </Field>
        <Field label="Per-operator fee">
          <Input
            inputMode="decimal"
            value={formatMoneyCents(billing.perOperatorFeeCents)}
            onChange={(e) =>
              setBilling({ ...billing, perOperatorFeeCents: parseMoneyToCents(e.target.value) })
            }
          />
        </Field>
        <Field label="Seat pack size">
          <NumberField
            value={billing.seatPackSize}
            min={1}
            onChange={(seatPackSize) => setBilling({ ...billing, seatPackSize })}
          />
        </Field>
        <Field label="Seat pack fee">
          <Input
            inputMode="decimal"
            value={formatMoneyCents(billing.seatPackFeeCents)}
            onChange={(e) =>
              setBilling({ ...billing, seatPackFeeCents: parseMoneyToCents(e.target.value) })
            }
          />
        </Field>
        <Field label="Device pack size">
          <NumberField
            value={billing.devicePackSize}
            min={1}
            onChange={(devicePackSize) => setBilling({ ...billing, devicePackSize })}
          />
        </Field>
        <Field label="Device pack fee">
          <Input
            inputMode="decimal"
            value={formatMoneyCents(billing.devicePackFeeCents)}
            onChange={(e) =>
              setBilling({ ...billing, devicePackFeeCents: parseMoneyToCents(e.target.value) })
            }
          />
        </Field>
        <Field label="Annual prepaid discount %">
          <NumberField
            value={billing.annualDiscountPercent}
            min={0}
            max={90}
            onChange={(annualDiscountPercent) => setBilling({ ...billing, annualDiscountPercent })}
          />
        </Field>
      </div>
    </SectionCard>
  );
}

function PaymentsSection({
  initial,
  saving,
  onSave,
}: {
  initial: PaymentsSettings;
  saving: boolean;
  onSave: (v: PaymentsSettings) => Promise<void>;
}) {
  const [v, setV] = useState(initial);
  const [rail, setRail] = useState<{ configured: boolean; environment: string } | null>(null);
  useEffect(() => setV(initial), [initial]);
  useEffect(() => {
    void import("@/lib/payments/onboarding-api").then((m) =>
      m
        .getProcessorRailStatusFn()
        .then(setRail)
        .catch(() => setRail({ configured: false, environment: "sandbox" })),
    );
  }, []);
  return (
    <SectionCard
      title="Payments & gift defaults"
      description="Quantum Payments mode and first-party gift liability defaults for new locations."
      saving={saving}
      onSave={() => onSave(v)}
    >
      <Field
        label="Processor rail"
        hint="Server environment only — keys never appear here. Guest and POS UI always say Quantum Payments."
      >
        <p className="flex h-11 items-center rounded-lg border border-border bg-surface px-3 text-sm">
          {rail?.configured ? "Configured" : "Not configured"}
          {rail ? ` · ${rail.environment}` : ""}
        </p>
      </Field>
      <Field
        label="Default Quantum Payments mode"
        hint="Sandbox is default. Live needs an approved host application, server-only keys, and a supplied reader. Locations can inherit or override. Training always sandboxes. Never a Stripe/Square POS picker."
      >
        <SelectField
          value={v.quantumPaymentsMode}
          onChange={(quantumPaymentsMode) =>
            setV({ ...v, quantumPaymentsMode: quantumPaymentsMode as PaymentsSettings["quantumPaymentsMode"] })
          }
        >
          {PAYMENTS_MODES.map((m) => (
            <option key={m} value={m}>
              {m === "sandbox" ? "Sandbox" : "Live"}
            </option>
          ))}
        </SelectField>
      </Field>
      <Field label="Default chargeback fee">
        <Input
          inputMode="decimal"
          value={formatMoneyCents(v.chargebackFeeCents)}
          onChange={(e) => setV({ ...v, chargebackFeeCents: parseMoneyToCents(e.target.value) })}
        />
      </Field>
      <Field label="Default gift issuer mode">
        <SelectField
          value={v.giftIssuerMode}
          onChange={(giftIssuerMode) =>
            setV({ ...v, giftIssuerMode: giftIssuerMode as PaymentsSettings["giftIssuerMode"] })
          }
        >
          {GIFT_ISSUER_MODES.map((m) => (
            <option key={m} value={m}>
              {m === "sale_point"
                ? "By sale-point operator"
                : m === "house"
                  ? "House only"
                  : "Joint split"}
            </option>
          ))}
        </SelectField>
      </Field>
      <Field label="Default gift term (months)" hint="0 = no term.">
        <NumberField
          value={v.giftTermMonths}
          min={0}
          max={120}
          onChange={(giftTermMonths) => setV({ ...v, giftTermMonths })}
        />
      </Field>
      <Field label="Operator-card residual at term">
        <SelectField
          value={v.operatorResidualMode}
          onChange={(operatorResidualMode) =>
            setV({
              ...v,
              operatorResidualMode: operatorResidualMode as PaymentsSettings["operatorResidualMode"],
            })
          }
        >
          {GIFT_RESIDUAL_MODES.map((m) => (
            <option key={m} value={m}>
              {m === "issuer_keeps"
                ? "Issuer keeps"
                : m === "split_equal"
                  ? "Split equal"
                  : "Custom %"}
            </option>
          ))}
        </SelectField>
      </Field>
      {v.operatorResidualMode === "custom" && (
        <Field label="House share of operator residual (%)">
          <NumberField
            value={v.operatorResidualCustomPercent}
            min={0}
            max={100}
            onChange={(operatorResidualCustomPercent) =>
              setV({ ...v, operatorResidualCustomPercent })
            }
          />
        </Field>
      )}
      <ToggleRow
        label="House-issued residual: House retains"
        hint="Fixed policy. When enabled, remaining house-issued balance stays with the house."
        checked={v.houseIssuedResidualEnabled}
        onChange={(houseIssuedResidualEnabled) => setV({ ...v, houseIssuedResidualEnabled })}
      />
      <Field label="Gift disclaimer">
        <textarea
          className="min-h-24 w-full rounded-lg border border-border bg-bg p-3 text-sm"
          value={v.giftDisclaimer}
          onChange={(e) => setV({ ...v, giftDisclaimer: e.target.value })}
        />
      </Field>
    </SectionCard>
  );
}

function CommunicationsSection({
  initial,
  sms,
  email,
  outbox,
  saving,
  onSave,
}: {
  initial: CommunicationsSettings;
  sms: boolean;
  email: boolean;
  outbox: EmailOutboxRow[];
  saving: boolean;
  onSave: (v: CommunicationsSettings) => Promise<void>;
}) {
  const [v, setV] = useState(initial);
  useEffect(() => setV(initial), [initial]);
  return (
    <SectionCard
      title="Communications"
      description="SMS and email status come from the environment. Templates are edited as text, with helper tokens. Without an API key, quote mail is logged to the outbox."
      saving={saving}
      onSave={() => onSave(v)}
    >
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 text-sm">
          SMS <StatusPill ok={sms} okLabel="Configured" offLabel="Not configured" />
        </div>
        <div className="flex items-center gap-2 text-sm">
          Email <StatusPill ok={email} okLabel="Configured" offLabel="Not configured" />
        </div>
      </div>
      <Field label="From name" hint="Display name on quote emails. Address stays in the environment.">
        <Input value={v.fromName} onChange={(e) => setV({ ...v, fromName: e.target.value })} />
      </Field>
      <Field label="Waitlist confirm template">
        <TokenChips
          tokens={WAITLIST_TOKENS}
          onInsert={(t) => setV({ ...v, waitlistConfirmTemplate: `${v.waitlistConfirmTemplate} ${t}` })}
        />
        <textarea
          className="mt-2 min-h-24 w-full rounded-lg border border-border bg-bg p-3 text-sm"
          value={v.waitlistConfirmTemplate}
          onChange={(e) => setV({ ...v, waitlistConfirmTemplate: e.target.value })}
        />
      </Field>
      <Field label="Table-ready template">
        <TokenChips
          tokens={WAITLIST_TOKENS}
          onInsert={(t) =>
            setV({ ...v, waitlistTableReadyTemplate: `${v.waitlistTableReadyTemplate} ${t}` })
          }
        />
        <textarea
          className="mt-2 min-h-24 w-full rounded-lg border border-border bg-bg p-3 text-sm"
          value={v.waitlistTableReadyTemplate}
          onChange={(e) => setV({ ...v, waitlistTableReadyTemplate: e.target.value })}
        />
      </Field>
      <Field label="Invite email subject">
        <TokenChips
          tokens={INVITE_TOKENS}
          onInsert={(t) => setV({ ...v, inviteEmailSubject: `${v.inviteEmailSubject} ${t}` })}
        />
        <Input
          className="mt-2"
          value={v.inviteEmailSubject}
          onChange={(e) => setV({ ...v, inviteEmailSubject: e.target.value })}
        />
      </Field>
      <Field label="Invite email body">
        <TokenChips
          tokens={INVITE_TOKENS}
          onInsert={(t) => setV({ ...v, inviteEmailBody: `${v.inviteEmailBody}${t}` })}
        />
        <textarea
          className="mt-2 min-h-32 w-full rounded-lg border border-border bg-bg p-3 text-sm"
          value={v.inviteEmailBody}
          onChange={(e) => setV({ ...v, inviteEmailBody: e.target.value })}
        />
      </Field>
      <p className="pt-2 text-sm font-medium">Quote emails</p>
      <p className="text-xs text-muted-foreground">
        Tokens: company, plan, monthly, setup, locations, quote link, support, from name.
      </p>
      {(
        [
          ["quoteRequestSubject", "quoteRequestBody", "Quote request received (prospect)"],
          ["quoteSentSubject", "quoteSentBody", "Quote sent (prospect)"],
          ["quoteAcceptedSubject", "quoteAcceptedBody", "Quote accepted (prospect)"],
          ["quoteInternalSubject", "quoteInternalBody", "New quote request (internal)"],
          ["hostReadySubject", "hostReadyBody", "Host account ready (invite operators)"],
          ["tenantInviteSubject", "tenantInviteBody", "Tenant invite"],
          ["tenantCompleteSubject", "tenantCompleteBody", "Tenant completed (host notify)"],
        ] as const
      ).map(([subj, body, label]) => (
        <div key={subj} className="space-y-2">
          <Field label={`${label} — subject`}>
            <TokenChips
              tokens={
                subj.startsWith("tenant") || subj.startsWith("hostReady")
                  ? TENANT_EMAIL_TOKENS
                  : QUOTE_EMAIL_TOKENS
              }
              onInsert={(t) => setV({ ...v, [subj]: `${v[subj]} ${t}` })}
            />
            <Input
              className="mt-2"
              value={v[subj]}
              onChange={(e) => setV({ ...v, [subj]: e.target.value })}
            />
          </Field>
          <Field label="Body">
            <textarea
              className="min-h-24 w-full rounded-lg border border-border bg-bg p-3 text-sm"
              value={v[body]}
              onChange={(e) => setV({ ...v, [body]: e.target.value })}
            />
          </Field>
        </div>
      ))}
      <div>
        <p className="text-sm font-medium">Email outbox</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {email
            ? "Provider connected. Failed rows still land here."
            : "No API key — quote mail is logged only (not delivered)."}
        </p>
        <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-xs">
          {outbox.length === 0 && (
            <li className="text-muted-foreground">No messages yet.</li>
          )}
          {outbox.map((row) => (
            <li key={row.id} className="rounded-lg border border-border px-2 py-1.5">
              <span className="font-medium">{row.status}</span>
              {" · "}
              {row.kind}
              {" · "}
              {row.to}
              <span className="mt-0.5 block text-muted-foreground">{row.subject}</span>
            </li>
          ))}
        </ul>
      </div>
    </SectionCard>
  );
}

function FlagsSection({
  initial,
  saving,
  onSave,
}: {
  initial: FeatureFlagSettings;
  saving: boolean;
  onSave: (v: FeatureFlagSettings) => Promise<void>;
}) {
  const [v, setV] = useState(initial);
  useEffect(() => setV(initial), [initial]);
  return (
    <SectionCard
      title="Feature flags"
      description="Global defaults for new orgs. Per-plan overrides live under Plans & billing."
      saving={saving}
      onSave={() => onSave(v)}
    >
      <div className="space-y-2">
        {MODULE_FLAG_KEYS.map((key) => (
          <ToggleRow
            key={key}
            label={MODULE_FLAG_LABEL[key]}
            checked={v[key]}
            onChange={(on) => setV({ ...v, [key]: on })}
          />
        ))}
      </div>
    </SectionCard>
  );
}

function ComplianceSection({
  initial,
  saving,
  onSave,
}: {
  initial: ComplianceSettings;
  saving: boolean;
  onSave: (v: ComplianceSettings) => Promise<void>;
}) {
  const [v, setV] = useState(initial);
  useEffect(() => setV(initial), [initial]);
  return (
    <SectionCard
      title="Data & compliance"
      description="Retention windows. 0 days on waitlist phones means keep indefinitely."
      saving={saving}
      onSave={() => onSave(v)}
    >
      <Field label="Waitlist phone retention (days)" hint="0 = indefinite.">
        <NumberField
          value={v.waitlistPhoneRetentionDays}
          min={0}
          max={3650}
          onChange={(waitlistPhoneRetentionDays) => setV({ ...v, waitlistPhoneRetentionDays })}
        />
      </Field>
      <Field label="Audit log retention (days)">
        <NumberField
          value={v.auditLogRetentionDays}
          min={30}
          max={3650}
          onChange={(auditLogRetentionDays) => setV({ ...v, auditLogRetentionDays })}
        />
      </Field>
      <Field label="Privacy process notes">
        <textarea
          className="min-h-32 w-full rounded-lg border border-border bg-bg p-3 text-sm"
          value={v.privacyProcessNotes}
          onChange={(e) => setV({ ...v, privacyProcessNotes: e.target.value })}
        />
      </Field>
    </SectionCard>
  );
}

function TeamSection({
  team,
  onChanged,
}: {
  team: PlatformTeamMember[];
  onChanged: (b: SettingsBundle) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<PlatformTeamRole>("sales");
  const [busy, setBusy] = useState(false);
  const adminCount = useMemo(
    () => team.filter((t) => t.role === "admin" && t.status === "active").length,
    [team],
  );

  return (
    <section className="max-w-3xl space-y-4 rounded-2xl border border-border bg-surface p-4">
      <div>
        <h3 className="text-base font-semibold">Team</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform users only. Floor staff live on the location. Settings stay platform_admin.
        </p>
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          void invitePlatformUserFn({ data: { email, role } })
            .then((r) => {
              toast.success(
                r.emailSent
                  ? `Invite sent to ${email}`
                  : r.tempPassword
                    ? `User added. Temporary password: ${r.tempPassword}`
                    : `User added (${email})`,
              );
              setEmail("");
              return loadPlatformSettingsFn();
            })
            .then((b) => onChanged(b))
            .catch((err) => toast.error(errMessage(err)))
            .finally(() => setBusy(false));
        }}
      >
        <Field label="Invite email">
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@summex.app"
          />
        </Field>
        <Field label="Role">
          <SelectField value={role} onChange={(r) => setRole(r as PlatformTeamRole)}>
            {PLATFORM_TEAM_ROLES.map((r) => (
              <option key={r} value={r}>
                {r === "read_only" ? "Read only" : r[0]!.toUpperCase() + r.slice(1)}
              </option>
            ))}
          </SelectField>
        </Field>
        <Button type="submit" disabled={busy || !email}>
          {busy ? "Inviting…" : "Invite"}
        </Button>
      </form>
      <div className="divide-y divide-border rounded-xl border border-border">
        {team.map((u) => {
          const soleAdmin = u.role === "admin" && u.status === "active" && adminCount <= 1;
          return (
            <div key={u.userId} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <div className="min-w-40 flex-1">
                <p className="text-sm font-medium">
                  {u.name}
                  {u.isSelf ? <span className="ml-1 text-xs text-muted-foreground">(you)</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              <select
                className="h-10 rounded-lg border border-border bg-surface px-2 text-sm"
                value={u.role}
                disabled={soleAdmin}
                onChange={(e) => {
                  const next = e.target.value as PlatformTeamRole;
                  void updatePlatformUserFn({ data: { userId: u.userId, role: next } })
                    .then(onChanged)
                    .catch((err) => toast.error(errMessage(err)));
                }}
              >
                {PLATFORM_TEAM_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r === "read_only" ? "Read only" : r[0]!.toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
              {u.status === "active" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={soleAdmin && u.isSelf}
                  onClick={() => {
                    void updatePlatformUserFn({
                      data: { userId: u.userId, status: "deactivated" },
                    })
                      .then(onChanged)
                      .catch((err) => toast.error(errMessage(err)));
                  }}
                >
                  Deactivate
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void updatePlatformUserFn({
                      data: { userId: u.userId, status: "active" },
                    })
                      .then(onChanged)
                      .catch((err) => toast.error(errMessage(err)));
                  }}
                >
                  Reactivate
                </Button>
              )}
            </div>
          );
        })}
        {team.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">No platform users yet.</p>
        ) : null}
      </div>
    </section>
  );
}

function DangerSection({
  factoryResetEnabled,
  envEnabled,
  envReason,
}: {
  factoryResetEnabled: boolean;
  envEnabled: boolean;
  envReason: string | null;
}) {
  const [resetEnabled, setResetEnabled] = useState<boolean | null>(null);
  const [resetReason, setResetReason] = useState<string | null>(null);
  const [phrase, setPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [acked, setAcked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetErr, setResetErr] = useState<string | null>(null);

  useEffect(() => {
    void factoryResetStatusFn()
      .then((s) => {
        setResetEnabled(s.enabled);
        setResetReason(s.reason ?? null);
      })
      .catch(() => {
        setResetEnabled(false);
        setResetReason("Could not load reset status");
      });
  }, [factoryResetEnabled]);

  const allowed = Boolean(factoryResetEnabled && envEnabled && resetEnabled);

  return (
    <section className="max-w-3xl rounded-2xl border border-danger/40 bg-danger/5 p-4" data-platform="factory-reset">
      <p className="text-sm font-semibold text-danger">Danger zone</p>
      <h3 className="mt-1 text-base font-semibold">Factory reset</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Irreversible. Deletes all orgs, locations, operators, CRM, prospects, pipeline,
        tickets, software invoices, ledger, devices, and staff except the platform Admin
        login. Does not seed demo venues. After reset, sign in as Admin with the initial
        password — you must change it if first-login change is on.
      </p>
      <GuideLearnLink topicId="factory-reset" compact>
        Learn
      </GuideLearnLink>
      {!factoryResetEnabled && (
        <p className="mt-3 text-sm text-warn">
          Factory reset is turned off in Security & auth. Enable the toggle there to show this action.
        </p>
      )}
      {factoryResetEnabled && !envEnabled && (
        <p className="mt-3 text-sm text-warn">{envReason}</p>
      )}
      {factoryResetEnabled && envEnabled && resetEnabled === false && (
        <p className="mt-3 text-sm text-warn">{resetReason}</p>
      )}
      {allowed && (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!acked) {
              setResetErr("Check the confirmation box");
              return;
            }
            setBusy(true);
            setResetErr(null);
            void factoryResetFn({ data: { confirmPhrase: phrase, password } })
              .then(() => {
                clearLocalAppData();
                void signOut("/login");
              })
              .catch((err) => {
                setBusy(false);
                setResetErr(err instanceof Error ? err.message : "Reset failed");
              });
          }}
        >
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border"
              checked={acked}
              onChange={(e) => setAcked(e.target.checked)}
            />
            <span>I understand this cannot be undone and will wipe all tenant and CRM data.</span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Type RESET to confirm</span>
            <Input
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              autoComplete="off"
              placeholder="RESET"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Admin password</span>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <Button
            type="submit"
            variant="destructive"
            disabled={
              busy ||
              !acked ||
              !password ||
              !["RESET", "FACTORY RESET"].includes(phrase.trim().toUpperCase())
            }
          >
            {busy ? "Resetting…" : "Factory reset"}
          </Button>
          {resetErr && (
            <p className="text-sm text-danger" role="alert">
              {resetErr}
            </p>
          )}
        </form>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Access is platform_admin only (password). Floor PIN is never used on this control plane.
      </p>
    </section>
  );
}
