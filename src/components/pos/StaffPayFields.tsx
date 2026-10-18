import { Input } from "@/components/ui/input";
import { Field, SelectField } from "@/components/platform/settings-fields";
import type { StaffPayDraft } from "@/lib/labor/staff-record";

export function StaffPayFields({
  value,
  onChange,
}: {
  value: StaffPayDraft;
  onChange: (next: StaffPayDraft) => void;
}) {
  const set = (patch: Partial<StaffPayDraft>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-3 sm:grid-cols-2" data-staff-pay="">
      <Field label="First name">
        <Input
          required
          value={value.firstName}
          onChange={(e) => set({ firstName: e.target.value })}
          autoComplete="given-name"
        />
      </Field>
      <Field label="Last name">
        <Input
          required
          value={value.lastName}
          onChange={(e) => set({ lastName: e.target.value })}
          autoComplete="family-name"
        />
      </Field>
      <Field label="Display name" hint="Blank uses first and last.">
        <Input
          value={value.displayName}
          onChange={(e) => set({ displayName: e.target.value })}
          autoComplete="off"
        />
      </Field>
      <Field label="Employee number" hint="Unique at this venue. Required on the hours file.">
        <Input
          required
          value={value.employeeNumber}
          onChange={(e) => set({ employeeNumber: e.target.value })}
          autoComplete="off"
        />
      </Field>
      <Field label="Pay rate">
        <div className="flex gap-2">
          <SelectField
            value={value.payRateType}
            onChange={(v) => set({ payRateType: v === "salary" ? "salary" : "hourly" })}
            className="w-32 shrink-0"
          >
            <option value="hourly">Hourly</option>
            <option value="salary">Salary</option>
          </SelectField>
          <Input
            required
            inputMode="decimal"
            value={value.payAmount}
            placeholder={value.payRateType === "salary" ? "Annual amount" : "Hourly amount"}
            onChange={(e) => set({ payAmount: e.target.value })}
            aria-label={value.payRateType === "salary" ? "Annual salary" : "Hourly rate"}
          />
        </div>
      </Field>
      <Field label="Hire date">
        <Input type="date" value={value.hireDate} onChange={(e) => set({ hireDate: e.target.value })} />
      </Field>
      <Field label="Status">
        <SelectField
          value={value.employmentStatus}
          onChange={(v) =>
            set({
              employmentStatus: v === "inactive" || v === "terminated" ? v : "active",
            })
          }
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="terminated">Terminated</option>
        </SelectField>
      </Field>
      <Field label="Position" hint="Optional. Shown on the list and the hours file when you type one.">
        <Input
          value={value.position}
          onChange={(e) => set({ position: e.target.value })}
          placeholder="Line cook"
        />
      </Field>
      <Field label="Email" hint="Optional. For notifications and the hours file.">
        <Input
          type="email"
          value={value.email}
          onChange={(e) => set({ email: e.target.value })}
          autoComplete="off"
        />
      </Field>
      <Field label="Phone" hint="Optional.">
        <Input
          value={value.phone}
          onChange={(e) => set({ phone: e.target.value })}
          autoComplete="off"
        />
      </Field>
    </div>
  );
}
