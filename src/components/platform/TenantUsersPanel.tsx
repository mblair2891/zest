import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, SelectField } from "@/components/platform/settings-fields";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addFloorStaffFn,
  addLocationAdminFn,
  listTenantUsersFn,
  resetTenantUserSecretFn,
  updateTenantUserFn,
} from "@/lib/saas/tenant-users-api";
import {
  TENANT_FLOOR_ROLES,
  TENANT_LOGIN_ROLES,
  TENANT_USERS_EMPTY,
  floorRoleLabel,
  formatFloorPinForAdmin,
  loginRoleLabel,
  membershipRoleForPasswordSeat,
  parseTenantAdminScope,
  tenantConsoleLoginUrl,
  type TenantAdminScope,
  type TenantUserRow,
} from "@/lib/saas/tenant-users";

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Could not save";
}

export function TenantUsersPanel({
  orgId,
  locationId,
  operators,
}: {
  orgId: string;
  locationId: string;
  operators: Array<{ id: string; dba: string }>;
}) {
  const loginUrl = tenantConsoleLoginUrl();
  const [rows, setRows] = useState<TenantUserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [forceChange, setForceChange] = useState(true);
  const [adminScope, setAdminScope] = useState<TenantAdminScope>("location");
  const [adminEntity, setAdminEntity] = useState("");
  const [adminSeat, setAdminSeat] = useState<"owner" | "manager" | "accountant">("owner");

  const [staffName, setStaffName] = useState("");
  const [staffPin, setStaffPin] = useState("");
  const [staffRole, setStaffRole] = useState("server");
  const [staffHome, setStaffHome] = useState("");
  const [hidePins, setHidePins] = useState(false);
  const [confirmReset, setConfirmReset] = useState<TenantUserRow | null>(null);

  const load = useCallback(() => {
    if (!orgId || !locationId) return;
    void listTenantUsersFn({ data: { orgId, locationId } })
      .then((list) => {
        setRows(list);
        setError(null);
      })
      .catch((e) => setError(errMessage(e)));
  }, [orgId, locationId]);

  useEffect(() => {
    load();
  }, [load]);

  const addAdmin = (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    void addLocationAdminFn({
      data: {
        orgId,
        locationId,
        name: adminName,
        email: adminEmail,
        tempPassword: adminPass,
        forceChange,
        operatorId: adminScope === "entity" && adminSeat !== "accountant" ? adminEntity || null : adminScope === "entity" ? adminEntity || null : null,
        role: membershipRoleForPasswordSeat({ scope: adminScope, seat: adminSeat }),
      },
    })
      .then((r) => {
        const kind = loginRoleLabel(
          membershipRoleForPasswordSeat({ scope: adminScope, seat: adminSeat }),
          adminScope === "entity" ? adminEntity : null,
        );
        setNotice(
          `${kind} added. They sign in at ${loginUrl} with ${adminEmail} — never PIN, never platform CRM. Temporary password: ${r.tempPassword}${
            r.forceChange ? " — they must change it on first login." : ""
          }`,
        );
        setAdminName("");
        setAdminEmail("");
        setAdminPass("");
        setForceChange(true);
        setAdminScope("location");
        setAdminEntity("");
        load();
      })
      .catch((err) => setError(errMessage(err)))
      .finally(() => setBusy(false));
  };

  const addStaff = (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    void addFloorStaffFn({
      data: {
        orgId,
        locationId,
        name: staffName,
        pin: staffPin,
        role: staffRole,
        homeEntityId: staffHome || null,
      },
    })
      .then(() => {
        setNotice(`Floor staff added. ${staffName} uses PIN ${staffPin} on this venue.`);
        setStaffName("");
        setStaffPin("");
        setStaffRole("server");
        setStaffHome("");
        load();
      })
      .catch((err) => setError(errMessage(err)))
      .finally(() => setBusy(false));
  };

  const floorRows = useMemo(
    () => (rows ?? []).filter((u) => u.kind === "floor"),
    [rows],
  );
  const loginRows = useMemo(
    () => (rows ?? []).filter((u) => u.kind === "login"),
    [rows],
  );

  const runReset = (u: TenantUserRow) => {
    setBusy(true);
    setNotice(null);
    setError(null);
    void resetTenantUserSecretFn({
      data: { orgId, locationId, kind: u.kind, id: u.id },
    })
      .then((r) => {
        if (u.kind === "login") {
          setNotice(
            r.tempPassword
              ? `New temporary password for ${u.name}: ${r.tempPassword}. They must change it on next login. The old password is not shown — Summex does not display account passwords.`
              : `Password reset for ${u.name}.`,
          );
        } else {
          setNotice(`New PIN for ${u.name}: ${r.pin}. The old PIN no longer works.`);
        }
        load();
      })
      .catch((err) => setError(errMessage(err)))
      .finally(() => {
        setBusy(false);
        setConfirmReset(null);
      });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5" data-demo="tenant-users">
      <div>
        <p className="text-sm font-semibold">Users</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Location owner, manager, and location admin. Floor PINs are the 4-digit
          station credential — listed here, not a password. Kitchen, server, and
          bartender PINs cannot open this tab. Password logins stay separate; account
          passwords are never shown. Isolated demo: Platform Admin may view PINs for
          support.
        </p>
      </div>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-xl border border-border bg-surface px-3 py-2 text-sm" role="status">
          {notice}
        </p>
      )}

      <form
        className="space-y-3 rounded-2xl border border-border bg-surface p-4"
        data-demo="tenant-add-admin"
        onSubmit={addAdmin}
      >
        <p className="text-sm font-medium">
          Add password login
        </p>
        <p className="text-xs text-muted-foreground">
          Email and temporary password. After login they land on that role’s dashboard
          — never a PIN pad.
        </p>
        <Field label="Scope">
          <SelectField
            value={adminScope}
            onChange={(v) => {
              const next = parseTenantAdminScope(v);
              setAdminScope(next);
              if (next === "location") setAdminEntity("");
            }}
          >
            <option value="location">Location admin (whole venue)</option>
            <option value="entity">Entity admin (one selling entity)</option>
          </SelectField>
        </Field>
        <Field label="Seat">
          <SelectField
            value={adminSeat}
            onChange={(v) =>
              setAdminSeat(v === "manager" || v === "accountant" ? v : "owner")
            }
          >
            <option value="owner">{adminScope === "entity" ? "Entity owner" : "Owner"}</option>
            <option value="manager">{adminScope === "entity" ? "Entity manager" : "Manager"}</option>
            <option value="accountant">Accountant</option>
          </SelectField>
        </Field>
        {adminScope === "entity" && adminSeat !== "accountant" && (
          <Field label="Selling entity" hint="Required. They only manage this brand.">
            <SelectField value={adminEntity} onChange={setAdminEntity}>
              <option value="">Choose entity</option>
              {operators.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.dba}
                </option>
              ))}
            </SelectField>
          </Field>
        )}
        <Field label="Name">
          <Input
            required
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            autoComplete="name"
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            required
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field
          label="Temporary password"
          hint="Leave blank to generate one. Shown once after save."
        >
          <Input
            type="text"
            value={adminPass}
            onChange={(e) => setAdminPass(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border"
            checked={forceChange}
            onChange={(e) => setForceChange(e.target.checked)}
          />
          Force password change on first login
        </label>
        <Button
          type="submit"
          disabled={
            busy ||
            !adminName ||
            !adminEmail ||
            (adminScope === "entity" && adminSeat !== "accountant" && !adminEntity)
          }
        >
          {busy ? "Saving…" : "Add password login"}
        </Button>
      </form>

      <form
        className="space-y-3 rounded-2xl border border-border bg-surface p-4"
        data-demo="tenant-add-staff"
        onSubmit={addStaff}
      >
        <p className="text-sm font-medium">Add floor staff (PIN only)</p>
        <p className="text-xs text-muted-foreground">Optional. Name, PIN, role, home entity.</p>
        <Field label="Name">
          <Input
            required
            value={staffName}
            onChange={(e) => setStaffName(e.target.value)}
          />
        </Field>
        <Field label="PIN">
          <Input
            required
            inputMode="numeric"
            pattern="\d{4,8}"
            value={staffPin}
            onChange={(e) => setStaffPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            autoComplete="off"
          />
        </Field>
        <Field label="Role">
          <SelectField value={staffRole} onChange={setStaffRole}>
            {TENANT_FLOOR_ROLES.map((r) => (
              <option key={r} value={r}>
                {floorRoleLabel(r)}
              </option>
            ))}
          </SelectField>
        </Field>
        <Field label="Home entity">
          <SelectField value={staffHome} onChange={setStaffHome}>
            <option value="">This venue</option>
            {operators.map((o) => (
              <option key={o.id} value={o.id}>
                {o.dba}
              </option>
            ))}
          </SelectField>
        </Field>
        <Button type="submit" variant="outline" disabled={busy || !staffName || staffPin.length < 4}>
          {busy ? "Saving…" : "Add floor staff"}
        </Button>
      </form>

      {rows === null && <p className="text-sm text-muted-foreground">Loading users…</p>}
      {rows?.length === 0 && (
        <p className="text-sm text-muted-foreground">{TENANT_USERS_EMPTY}</p>
      )}

      {rows && floorRows.length > 0 && (
        <section className="space-y-2" data-demo="venue-floor-pins">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">Floor staff</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setHidePins((v) => !v)}
            >
              {hidePins ? "Show PINs" : "Hide PINs"}
            </Button>
            <p className="text-xs text-muted-foreground">
              4-digit station PIN. Default shown. Disable keeps the row; the PIN no longer signs in.
            </p>
          </div>
          <ul className="space-y-2 text-sm">
            {floorRows.map((u) => (
              <li
                key={`floor-${u.id}`}
                data-demo="tenant-user-row"
                data-user-kind="floor"
                className="space-y-2 rounded-xl border border-border bg-surface px-3 py-2"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-medium">{u.name}</span>
                  {u.status === "disabled" ? (
                    <span className="text-xs text-muted-foreground">Disabled</span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {floorRoleLabel(u.role)}
                    {u.homeEntityName ? ` · ${u.homeEntityName}` : ""}
                    {` · ${u.clockedIn ? "On clock" : "Off clock"}`}
                  </span>
                  <span
                    className="ml-auto font-mono text-sm tabular-nums"
                    data-demo="floor-pin"
                  >
                    PIN {formatFloorPinForAdmin(u.pin, hidePins)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="h-10 rounded-lg border border-border bg-surface px-2 text-sm"
                    value={u.role}
                    disabled={busy}
                    onChange={(e) => {
                      const role = e.target.value;
                      setBusy(true);
                      void updateTenantUserFn({
                        data: { orgId, locationId, kind: "floor", id: u.id, role },
                      })
                        .then(() => load())
                        .catch((err) => setError(errMessage(err)))
                        .finally(() => setBusy(false));
                    }}
                  >
                    {TENANT_FLOOR_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {floorRoleLabel(r)}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    data-demo="reset-floor-pin"
                    onClick={() => setConfirmReset(u)}
                  >
                    Reset PIN
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      void updateTenantUserFn({
                        data: {
                          orgId,
                          locationId,
                          kind: "floor",
                          id: u.id,
                          status: u.status === "active" ? "disabled" : "active",
                        },
                      })
                        .then(() => load())
                        .catch((err) => setError(errMessage(err)))
                        .finally(() => setBusy(false));
                    }}
                  >
                    {u.status === "active" ? "Disable" : "Enable"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rows && loginRows.length > 0 && (
        <section className="space-y-2" data-demo="venue-password-logins">
          <p className="text-sm font-medium">Password logins</p>
          <p className="text-xs text-muted-foreground">
            Email sign-in at app.summex.app/login. Account passwords are never shown.
          </p>
          <ul className="space-y-2 text-sm">
            {loginRows.map((u) => (
              <li
                key={`login-${u.id}`}
                data-demo="tenant-user-row"
                data-user-kind="login"
                className="space-y-2 rounded-xl border border-border bg-surface px-3 py-2"
              >
                <div>
                  <span className="font-medium">{u.name}</span>
                  {u.status === "disabled" ? (
                    <span className="ml-2 text-xs text-muted-foreground">Disabled</span>
                  ) : null}
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {`${loginRoleLabel(u.role, u.homeEntityId)}${
                      u.homeEntityName ? ` · ${u.homeEntityName}` : ""
                    }${u.email ? ` · ${u.email}` : ""}`}
                    {u.mustChangePassword ? " · must change password" : ""}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="h-10 rounded-lg border border-border bg-surface px-2 text-sm"
                    value={u.role}
                    disabled={busy}
                    onChange={(e) => {
                      const role = e.target.value;
                      const homeEntityId =
                        role === "vendor"
                          ? u.homeEntityId || operators[0]?.id || null
                          : role === "owner"
                            ? null
                            : undefined;
                      setBusy(true);
                      void updateTenantUserFn({
                        data: {
                          orgId,
                          locationId,
                          kind: "login",
                          id: u.id,
                          role,
                          homeEntityId,
                        },
                      })
                        .then(() => load())
                        .catch((err) => setError(errMessage(err)))
                        .finally(() => setBusy(false));
                    }}
                  >
                    {TENANT_LOGIN_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {loginRoleLabel(r)}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-10 rounded-lg border border-border bg-surface px-2 text-sm"
                    value={u.homeEntityId || ""}
                    disabled={busy}
                    onChange={(e) => {
                      const homeEntityId = e.target.value || null;
                      setBusy(true);
                      void updateTenantUserFn({
                        data: { orgId, locationId, kind: "login", id: u.id, homeEntityId },
                      })
                        .then(() => load())
                        .catch((err) => setError(errMessage(err)))
                        .finally(() => setBusy(false));
                    }}
                  >
                    <option value="">Whole venue</option>
                    {operators.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.dba}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => runReset(u)}
                  >
                    Reset password
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      void updateTenantUserFn({
                        data: {
                          orgId,
                          locationId,
                          kind: "login",
                          id: u.id,
                          status: u.status === "active" ? "disabled" : "active",
                        },
                      })
                        .then(() => load())
                        .catch((err) => setError(errMessage(err)))
                        .finally(() => setBusy(false));
                    }}
                  >
                    {u.status === "active" ? "Disable" : "Enable"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialog open={Boolean(confirmReset)} onOpenChange={(o) => !o && setConfirmReset(null)}>
        <DialogContent className="max-w-sm" showClose={false}>
          <DialogHeader>
            <DialogTitle>Replace this PIN?</DialogTitle>
            <DialogDescription>
              {confirmReset
                ? `${confirmReset.name}’s current PIN will stop working immediately. A new 4-digit PIN is generated and shown here.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmReset(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || !confirmReset}
              onClick={() => confirmReset && runReset(confirmReset)}
            >
              {busy ? "Resetting…" : "Reset PIN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
