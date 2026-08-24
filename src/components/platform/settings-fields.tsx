import type { ReactNode } from "react";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
      <span className="block text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function SelectField({
  value,
  onChange,
  children,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground",
        className,
      )}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {children}
    </select>
  );
}

export function NumberField({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <Input
      type="number"
      min={min}
      max={max}
      step={step ?? 1}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => {
        const n = Number(e.target.value);
        onChange(Number.isFinite(n) ? n : 0);
      }}
    />
  );
}

export function ToggleRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-bg px-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-surface-2",
        )}
        onClick={() => onChange(!checked)}
      >
        <span
          className={cn(
            "absolute top-0.5 h-6 w-6 rounded-full bg-surface shadow-sm transition-all",
            checked ? "left-5" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}

export function ChipList({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {values.map((v, i) => (
          <span
            key={`${v}-${i}`}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs"
          >
            {v}
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${v}`}
              onClick={() => onChange(values.filter((_, j) => j !== i))}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const raw = String(fd.get("chip") ?? "").trim();
          e.currentTarget.reset();
          if (!raw || values.includes(raw)) return;
          onChange([...values, raw]);
        }}
      >
        <Input name="chip" className="h-10" placeholder={placeholder ?? "Add…"} />
        <Button type="submit" size="sm" variant="outline">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </form>
    </div>
  );
}

export function OrderedRows<T extends { id: string }>({
  rows,
  onChange,
  render,
  addLabel,
  onAdd,
}: {
  rows: T[];
  onChange: (next: T[]) => void;
  render: (row: T, index: number) => ReactNode;
  addLabel: string;
  onAdd: () => void;
}) {
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    const a = next[i];
    const b = next[j];
    if (!a || !b) return;
    next[i] = b;
    next[j] = a;
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div
          key={row.id}
          className="flex items-start gap-2 rounded-xl border border-border bg-bg p-2"
        >
          <div className="flex flex-col gap-0.5 pt-1">
            <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => move(i, -1)} aria-label="Move up">
              <ChevronUp className="h-4 w-4" />
            </button>
            <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => move(i, 1)} aria-label="Move down">
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          <div className="min-w-0 flex-1">{render(row, i)}</div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Remove"
            onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={onAdd}>
        <Plus className="h-4 w-4" />
        {addLabel}
      </Button>
    </div>
  );
}

export function TokenChips({ tokens, onInsert }: { tokens: readonly string[]; onInsert: (t: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tokens.map((t) => (
        <button
          key={t}
          type="button"
          className="rounded-full border border-border bg-surface-2 px-2 py-0.5 font-mono text-xs text-muted-foreground hover:text-foreground"
          onClick={() => onInsert(t)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export function StatusPill({ ok, okLabel, offLabel }: { ok: boolean; okLabel: string; offLabel: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center rounded-full px-3 text-xs font-medium",
        ok ? "bg-success/15 text-success" : "bg-surface-2 text-muted-foreground",
      )}
    >
      {ok ? okLabel : offLabel}
    </span>
  );
}

export function SectionCard({
  title,
  description,
  children,
  onSave,
  saving,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <section className="max-w-3xl space-y-4 rounded-2xl border border-border bg-surface p-4">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
      <div className="flex justify-end pt-2">
        <Button type="button" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </section>
  );
}
