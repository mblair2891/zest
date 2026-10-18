/** Venue Settings → Scheduling / Clock-in. Owner and manager write it. */
export function UnscheduledClockSetting({
  allow,
  write,
  onChange,
}: {
  allow: boolean;
  write: boolean;
  onChange: (allow: boolean) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-3" data-scheduling-clock-in>
      <p className="text-xs font-semibold">Scheduling / Clock-in</p>
      <p className="mt-1 text-xs text-muted-foreground">Allow clock-in for unscheduled shifts</p>
      <div
        className="mt-2 flex gap-2"
        role="group"
        aria-label="Allow clock-in for unscheduled shifts"
        data-allow-unscheduled={allow ? "on" : "off"}
      >
        <button
          type="button"
          className={
            !allow
              ? "h-9 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground"
              : "h-9 rounded-md border border-border px-3 text-xs"
          }
          aria-pressed={!allow}
          disabled={!write}
          onClick={() => onChange(false)}
        >
          Off
        </button>
        <button
          type="button"
          className={
            allow
              ? "h-9 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground"
              : "h-9 rounded-md border border-border px-3 text-xs"
          }
          aria-pressed={allow}
          disabled={!write}
          onClick={() => onChange(true)}
        >
          On
        </button>
      </div>
      {!write ? (
        <p className="mt-2 text-xs text-muted-foreground">A location admin or manager changes this.</p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Off blocks a clock-in when no shift covers now. On asks the person to confirm, then marks that punch
          Unscheduled.
        </p>
      )}
    </section>
  );
}
