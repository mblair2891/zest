import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";

export function WizardChrome({
  title,
  subtitle,
  step,
  total,
  labels,
  error,
  busy,
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
  learnTopicId,
  footerExtra,
  children,
}: {
  title: string;
  subtitle?: string;
  step: number;
  total: number;
  labels?: string[];
  error?: string | null;
  busy?: boolean;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  learnTopicId?: string;
  footerExtra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          Step {step} of {total}
          {labels?.[step - 1] ? ` · ${labels[step - 1]}` : ""}
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
        {subtitle && (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
        )}
        {learnTopicId && (
          <p className="mt-2">
            <GuideLearnLink topicId={learnTopicId}>
              Learn in Operators Guide
            </GuideLearnLink>
          </p>
        )}
      </div>
      <div className="flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${i < step ? "bg-primary" : "bg-surface-2"}`}
          />
        ))}
      </div>
      <div className="space-y-4">{children}</div>
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {onBack && (
          <Button type="button" variant="outline" className="flex-1" onClick={onBack} disabled={busy}>
            Back
          </Button>
        )}
        {footerExtra}
        {onNext && (
          <Button
            type="button"
            className="flex-1"
            onClick={onNext}
            disabled={busy || nextDisabled}
          >
            {busy ? "Saving…" : nextLabel ?? "Continue"}
          </Button>
        )}
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function ToggleChip({
  on,
  label,
  hint,
  onClick,
}: {
  on: boolean;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-left transition ${
        on ? "border-primary bg-primary/10" : "border-border bg-surface hover:border-primary/40"
      }`}
    >
      <span className="block text-sm font-semibold">{label}</span>
      {hint && (
        <span className="mt-0.5 block text-[11px] text-muted-foreground">{hint}</span>
      )}
    </button>
  );
}

export function NativeSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
    >
      {children}
    </select>
  );
}
