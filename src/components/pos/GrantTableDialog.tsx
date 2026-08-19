import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePosStore } from "@/lib/pos/store";
import type { ExtraTableGrantScope, Table } from "@/lib/pos/types";
import { canManageSections, policyOf } from "@/lib/pos/section-control";
import { ManagerPinDialog } from "./ManagerPinDialog";

interface GrantProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultEmployeeId?: string;
  defaultTableId?: string;
  onGranted?: (tableId: string) => void;
}

export function GrantTableDialog({
  open,
  onOpenChange,
  defaultEmployeeId,
  defaultTableId,
  onGranted,
}: GrantProps) {
  const employees = usePosStore((s) => s.employees);
  const tables = usePosStore((s) => s.tables);
  const grantExtraTable = usePosStore((s) => s.grantExtraTable);
  const current = usePosStore((s) => s.getCurrentEmployee());
  const [employeeId, setEmployeeId] = useState(
    defaultEmployeeId ?? current?.id ?? "",
  );
  const [tableId, setTableId] = useState(defaultTableId ?? "");
  const [scope, setScope] = useState<ExtraTableGrantScope>("shift");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const staff = employees.filter(
    (e) => e.active && ["server", "bartender", "host"].includes(e.role),
  );
  const openTables = tables.filter((t) => !t.mergedIntoId);

  const submit = () => {
    if (!employeeId || !tableId) {
      setError("Pick a person and a table");
      return;
    }
    const res = grantExtraTable({
      employeeId,
      tableId,
      scope,
      reason: reason.trim() || undefined,
    });
    if (!res.ok) {
      setError(res.error ?? "Could not grant");
      return;
    }
    setError(null);
    onOpenChange(false);
    onGranted?.(tableId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Grant a table outside section</DialogTitle>
          <DialogDescription>
            Assign one table in another section for this shift, or just this
            seating. Shift grants drop at clock-out; seating grants drop when
            the table is cleared.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Staff</span>
            <select
              className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">Select…</option>
              {staff.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {e.role}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Table</span>
            <select
              className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm"
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
            >
              <option value="">Select…</option>
              {openTables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} · {t.section}
                </option>
              ))}
            </select>
          </label>
          <div>
            <span className="mb-1 block text-sm text-muted-foreground">
              Duration
            </span>
            <div className="flex gap-2">
              {(
                [
                  ["shift", "This shift"],
                  ["seating", "This seating only"],
                ] as const
              ).map(([id, label]) => (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant={scope === id ? "default" : "outline"}
                  onClick={() => setScope(id)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">
              Reason (optional)
            </span>
            <input
              className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Overflow, large party…"
            />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>Grant table</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AccessProps {
  table: Table | null;
  reason: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onResolved: (table: Table) => void;
}

export function SectionAccessDialog({
  table,
  reason,
  open,
  onOpenChange,
  onResolved,
}: AccessProps) {
  const emp = usePosStore((s) => s.getCurrentEmployee());
  const settings = usePosStore((s) => s.settings);
  const grantExtraTable = usePosStore((s) => s.grantExtraTable);
  const overrideSectionTable = usePosStore((s) => s.overrideSectionTable);
  const [pinOpen, setPinOpen] = useState(false);
  const [pending, setPending] = useState<"shift" | "seating" | "override" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const policy = useMemo(
    () => policyOf(settings.sectionPolicy),
    [settings.sectionPolicy],
  );
  const isMgr = canManageSections(emp?.role);

  const apply = (kind: "shift" | "seating" | "override") => {
    if (!table || !emp) return;
    if (kind === "override") {
      const res = overrideSectionTable(emp.id, table.id);
      if (!res.ok) {
        setError(res.error ?? "Override failed");
        return;
      }
    } else {
      const res = grantExtraTable({
        employeeId: emp.id,
        tableId: table.id,
        scope: kind,
        reason: "Manager grant from floor",
      });
      if (!res.ok) {
        setError(res.error ?? "Grant failed");
        return;
      }
    }
    setError(null);
    onOpenChange(false);
    onResolved(table);
  };

  const request = (kind: "shift" | "seating" | "override") => {
    setError(null);
    if (isMgr) {
      apply(kind);
      return;
    }
    setPending(kind);
    setPinOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Outside your section
              {table ? ` · ${table.label}` : ""}
            </DialogTitle>
            <DialogDescription>
              {reason}
              {table ? ` This table is in ${table.section}.` : ""}
            </DialogDescription>
          </DialogHeader>
          {policy.extraTableGrantsEnabled && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Grant this table
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => request("shift")}
                >
                  {isMgr ? "Grant for shift" : "Ask manager · shift"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => request("seating")}
                >
                  {isMgr ? "Grant this seating" : "Ask manager · seating"}
                </Button>
              </div>
            </div>
          )}
          {policy.allowManagerOverride && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => request("override")}
            >
              {isMgr ? "Override this login" : "Manager override this login"}
            </Button>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ManagerPinDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        title="Manager authorization"
        description="A manager PIN is required to grant a table or override section limits."
        onVerified={() => {
          if (pending) apply(pending);
          setPending(null);
        }}
      />
    </>
  );
}
