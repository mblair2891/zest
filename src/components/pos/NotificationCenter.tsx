import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, Trash2, Volume2, VolumeX } from "lucide-react";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePosStore } from "@/lib/pos/store";
import {
  playBumpChime,
  useNotifyStore,
  type PosNotice,
} from "@/lib/pos/notify-store";
import { cn, formatTime } from "@/lib/utils";
import type { KitchenTicket, TicketStatus } from "@/lib/pos/types";

const FOH_ROLES = new Set([
  "owner",
  "manager",
  "server",
  "host",
  "bartender",
  "busser",
]);

function shouldToast(notice: PosNotice, role: string, view: string): boolean {
  if (notice.kind === "ticket_bumped") {
    // KDS operator already sees the bump they just made
    if (
      (view === "kitchen" && notice.station === "kitchen") ||
      (view === "bar" && notice.station === "bar")
    ) {
      return false;
    }
    return FOH_ROLES.has(role);
  }
  return FOH_ROLES.has(role);
}

export function TicketBumpWatcher() {
  const tickets = usePosStore((s) => s.tickets);
  const view = usePosStore((s) => s.view);
  const employees = usePosStore((s) => s.employees);
  const currentEmployeeId = usePosStore((s) => s.currentEmployeeId);
  const emp = employees.find((e) => e.id === currentEmployeeId) ?? null;
  const pushFromTicket = useNotifyStore((s) => s.pushFromTicket);
  const soundEnabled = useNotifyStore((s) => s.soundEnabled);
  const desktopEnabled = useNotifyStore((s) => s.desktopEnabled);
  const prev = useRef<Map<string, TicketStatus>>(new Map());
  const primed = useRef(false);

  useEffect(() => {
    const next = new Map<string, TicketStatus>(
      tickets.map((t: KitchenTicket) => [t.id, t.status]),
    );
    if (!primed.current) {
      primed.current = true;
      prev.current = next;
      return;
    }
    for (const t of tickets as KitchenTicket[]) {
      const was = prev.current.get(t.id);
      if (!was) continue;
      if (was !== "bumped" && t.status === "bumped") {
        const notice = pushFromTicket(t, "ticket_bumped");
        if (shouldToast(notice, emp?.role ?? "", view)) {
          toast.success(notice.title, {
            description: notice.body,
            duration: 8000,
          });
          if (soundEnabled) playBumpChime();
          if (
            desktopEnabled &&
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            try {
              new Notification(notice.title, { body: notice.body });
            } catch {
              /* ignore */
            }
          }
        }
      }
      if (was === "bumped" && t.status !== "bumped") {
        const notice = pushFromTicket(t, "ticket_recalled");
        if (shouldToast(notice, emp?.role ?? "", view)) {
          toast(notice.title, { description: notice.body, duration: 5000 });
        }
      }
    }
    prev.current = next;
  }, [
    tickets,
    pushFromTicket,
    emp?.role,
    view,
    soundEnabled,
    desktopEnabled,
  ]);

  return (
    <Toaster
      theme="dark"
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        className: "!bg-surface !border-border !text-foreground",
      }}
    />
  );
}

export function NotificationBell() {
  const employees = usePosStore((s) => s.employees);
  const currentEmployeeId = usePosStore((s) => s.currentEmployeeId);
  const emp = employees.find((e) => e.id === currentEmployeeId) ?? null;
  const notices = useNotifyStore((s) => s.notices);
  const soundEnabled = useNotifyStore((s) => s.soundEnabled);
  const setSoundEnabled = useNotifyStore((s) => s.setSoundEnabled);
  const desktopEnabled = useNotifyStore((s) => s.desktopEnabled);
  const setDesktopEnabled = useNotifyStore((s) => s.setDesktopEnabled);
  const markRead = useNotifyStore((s) => s.markRead);
  const markAllRead = useNotifyStore((s) => s.markAllRead);
  const clearAll = useNotifyStore((s) => s.clearAll);
  const setView = usePosStore((s) => s.setView);
  const [open, setOpen] = useState(false);

  const visible = useMemo(
    () => notices.filter((n) => {
      if (!emp) return false;
      if (emp.role === "owner" || emp.role === "manager" || emp.role === "host")
        return true;
      if (emp.role === "server" || emp.role === "busser") return true;
      if (emp.role === "bartender") return true;
      if (emp.role === "kitchen") return n.station === "kitchen";
      return n.serverName === emp.name;
    }),
    [notices, emp],
  );
  const unread = visible.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <Button
        size="icon"
        variant="ghost"
        className="relative h-9 w-9"
        aria-label={
          unread > 0
            ? `Notifications, ${unread} unread`
            : "Notifications"
        }
        onClick={() => {
          setOpen((v) => !v);
          if (!open && unread > 0) {
            /* keep unread until they look at each, or mark all via button */
          }
        }}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 z-50 mt-1 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-surface shadow-xl"
            role="dialog"
            aria-label="Notifications"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
              <p className="text-sm font-semibold">Notifications</p>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  aria-label={soundEnabled ? "Mute bump chime" : "Unmute bump chime"}
                  onClick={() => setSoundEnabled(!soundEnabled)}
                >
                  {soundEnabled ? (
                    <Volume2 className="h-3.5 w-3.5" />
                  ) : (
                    <VolumeX className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  aria-label="Mark all read"
                  onClick={() => markAllRead()}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  aria-label="Clear all"
                  onClick={() => clearAll()}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <ul className="max-h-[min(22rem,50vh)] overflow-y-auto">
              {visible.length === 0 && (
                <li className="px-3 py-8 text-center text-xs text-muted-foreground">
                  No bumps yet. Kitchen bumping a ticket will ping the floor here.
                </li>
              )}
              {visible.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={cn(
                      "w-full border-b border-border/60 px-3 py-2.5 text-left transition hover:bg-surface-2",
                      !n.read && "bg-primary/5",
                    )}
                    onClick={() => {
                      markRead(n.id);
                      setOpen(false);
                      setView("floor");
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug">
                        {n.title}
                      </p>
                      {!n.read && (
                        <Badge variant="success" className="shrink-0 text-[10px]">
                          New
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                      {n.body}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatTime(n.createdAt)}
                      {n.station === "bar" ? " · Bar" : " · Kitchen"}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
            <div className="border-t border-border px-3 py-2">
              <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={desktopEnabled}
                  onChange={async (e) => {
                    const on = e.target.checked;
                    if (on && typeof Notification !== "undefined") {
                      const perm = await Notification.requestPermission();
                      setDesktopEnabled(perm === "granted");
                    } else {
                      setDesktopEnabled(false);
                    }
                  }}
                />
                Desktop alerts (this device)
              </label>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
