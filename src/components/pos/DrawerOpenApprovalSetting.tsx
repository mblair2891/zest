/** Venue Settings → Cash / Drawer. Owner and manager write it. */
export function DrawerOpenApprovalSetting({
  requires,
  write,
  onChange,
}: {
  requires: boolean;
  write: boolean;
  onChange: (requires: boolean) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-3" data-cash-drawer>
      <p className="text-xs font-semibold">Cash / Drawer</p>
      <p className="mt-1 text-xs text-muted-foreground">Cash drawer open requires manager approval</p>
      <div
        className="mt-2 flex gap-2"
        role="group"
        aria-label="Cash drawer open requires manager approval"
        data-drawer-approval={requires ? "on" : "off"}
      >
        <button
          type="button"
          className={
            !requires
              ? "h-9 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground"
              : "h-9 rounded-md border border-border px-3 text-xs"
          }
          aria-pressed={!requires}
          disabled={!write}
          onClick={() => onChange(false)}
        >
          Off
        </button>
        <button
          type="button"
          className={
            requires
              ? "h-9 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground"
              : "h-9 rounded-md border border-border px-3 text-xs"
          }
          aria-pressed={requires}
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
          On asks for a manager PIN before the drawer opens. Off opens the drawer for staff who already have
          that drawer.
        </p>
      )}
    </section>
  );
}
