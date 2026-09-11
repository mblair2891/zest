import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, SelectField } from "@/components/platform/settings-fields";
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
  loginRoleLabel,
  tenantConsoleLoginUrl,
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

  const [staffName, setStaffName] = useState("");
  const [staffPin, setStaffPin] = useState("");
  const [staffRole, setStaffRole] = useState("server");
  const [staffHome, setStaffHome] = useState("");

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
      },
    })
      .then((r) => {
        setNotice(
          `Location admin added. They sign in at ${loginUrl} with ${adminEmail}. Temporary password: ${r.tempPassword}${
            r.forceChange ? " — they must change it on first login." : ""
          }`,
        );
        setAdminName("");
        setAdminEmail("");
        setAdminPass("");
        setForceChange(true);
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

  return (
    <div className="mx-auto max-w-lg space-y-5" data-demo="tenant-users">
      <div>
        <p className="text-sm font-semibold">Users</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Location admins sign in at {loginUrl} and only see this venue — not other
          tenants or the control plane. Isolated demo houses included. Floor staff
          who only need a PIN can be added here. You cannot create a second platform
          Admin.
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
        <p className="text-sm font-medium">Add location admin</p>
        <p className="text-xs text-muted-foreground">
          Role is location admin (venue owner). Email and temporary password.
        </p>
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
        <Button type="submit" disabled={busy || !adminName || !adminEmail}>
          {busy ? "Saving…" : "Add location admin"}
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

      <ul className="space-y-2 text-sm">
        {rows === null && <li className="text-muted-foreground">Loading users…</li>}
        {rows?.length === 0 && (
          <li className="text-muted-foreground">{TENANT_USERS_EMPTY}</li>
        )}
        {rows?.map((u) => (
          <li
            key={`${u.kind}-${u.id}`}
            data-demo="tenant-user-row"
            className="space-y-2 rounded-xl border border-border bg-surface px-3 py-2"
          >
            <div>
              <span className="font-medium">{u.name}</span>
              {u.status === "disabled" ? (
                <span className="ml-2 text-xs text-muted-foreground">Disabled</span>
              ) : null}
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {u.kind === "login"
                  ? `${loginRoleLabel(u.role)}${u.email ? ` · ${u.email}` : ""}`
                  : `Floor · ${floorRoleLabel(u.role)}${
                      u.homeEntityName ? ` · ${u.homeEntityName}` : ""
                    }`}
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
                  setBusy(true);
                  void updateTenantUserFn({
                    data: { orgId, locationId, kind: u.kind, id: u.id, role },
                  })
                    .then(() => load())
                    .catch((err) => setError(errMessage(err)))
                    .finally(() => setBusy(false));
                }}
              >
                {(u.kind === "login" ? TENANT_LOGIN_ROLES : TENANT_FLOOR_ROLES).map((r) => (
                  <option key={r} value={r}>
                    {u.kind === "login" ? loginRoleLabel(r) : floorRoleLabel(r)}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setNotice(null);
                  void resetTenantUserSecretFn({
                    data: { orgId, locationId, kind: u.kind, id: u.id },
                  })
                    .then((r) => {
                      setNotice(
                        r.tempPassword
                          ? `New temporary password for ${u.name}: ${r.tempPassword}. They must change it on next login.`
                          : `New PIN for ${u.name}: ${r.pin}`,
                      );
                      load();
                    })
                    .catch((err) => setError(errMessage(err)))
                    .finally(() => setBusy(false));
                }}
              >
                {u.kind === "login" ? "Reset password" : "Reset PIN"}
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
                      kind: u.kind,
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
    </div>
  );
}
