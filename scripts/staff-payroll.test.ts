import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { payrollCsv, type PayrollRow } from "../src/lib/labor/payroll.ts";
import {
  guestStaffName,
  laborCostByGroup,
  laborCostCents,
  resolveStaffName,
  splitPersonName,
  staffDisplayName,
  sumLaborCents,
  validateStaffPay,
} from "../src/lib/labor/staff-record.ts";

test("a single name splits into first and last", () => {
  assert.deepEqual(splitPersonName("Ada Lovelace"), { firstName: "Ada", lastName: "Lovelace" });
  assert.deepEqual(splitPersonName("Ada"), { firstName: "Ada", lastName: "" });
  assert.deepEqual(splitPersonName("Mary Ann Evans"), { firstName: "Mary Ann", lastName: "Evans" });
  assert.equal(staffDisplayName({ firstName: "Ada", lastName: "Lovelace", displayName: "" }), "Ada Lovelace");
  assert.equal(staffDisplayName({ firstName: "Ada", lastName: "Lovelace", displayName: "Addy" }), "Addy");
  const resolved = resolveStaffName({ name: "Ada Lovelace" });
  assert.equal(resolved.firstName, "Ada");
  assert.equal(resolved.lastName, "Lovelace");
  assert.equal(resolved.name, "Ada Lovelace");
});

test("guest checks use a first name and last initial", () => {
  assert.equal(guestStaffName({ firstName: "Ada", lastName: "Lovelace" }), "Ada L.");
  assert.equal(guestStaffName({ firstName: "Mary Ann", lastName: "Evans" }), "Mary Ann E.");
  assert.equal(guestStaffName("Ada"), "Ada");
  assert.equal(guestStaffName("Ada L."), "Ada L.");
  assert.equal(guestStaffName({ name: "Ada Lovelace" }), "Ada L.");
});

test("hourly and salary labor use the staff rate", () => {
  assert.equal(laborCostCents({ payRateType: "hourly", payRateCents: 1500, minutes: 120 }), 3000);
  assert.equal(laborCostCents({ payRateType: "salary", payRateCents: 5_200_000, minutes: 60 }), 2500);
  const grouped = laborCostByGroup([
    {
      employeeId: "a",
      employeeName: "Ada Lovelace",
      entityId: "food",
      role: "server",
      minutes: 60,
      payRateType: "hourly",
      payRateCents: 2000,
    },
  ]);
  assert.equal(grouped.totalCents, 2000);
  assert.equal(grouped.byEntity.get("food"), 2000);
  assert.equal(grouped.byRole.get("server"), 2000);
  assert.equal(grouped.byEmployee.get("a")?.cents, 2000);
});

test("no personal rate keeps one house-wage total", () => {
  const labor = sumLaborCents([{ minutes: 120 }], 1500);
  assert.equal(labor.cents, 3000);
  assert.equal(labor.byRole.length, 0);
  assert.equal(labor.byEmployee.length, 0);
});

test("the hours file lists the employee number and the pay rate", () => {
  const csv = payrollCsv([
    {
      employeeId: "e1",
      name: "Ada Lovelace",
      role: "server",
      operatorId: "food",
      operatorName: "Kitchen",
      regularHours: 8,
      otHours: 1,
      otFlag: true,
      otDaily: false,
      otWeekly: true,
      otSeventh: false,
      tipsCents: 0,
      salesCents: 0,
      punchCount: 1,
      employeeNumber: "E-14",
      firstName: "Ada",
      lastName: "Lovelace",
      payRateType: "hourly",
      payRateCents: 1800,
    },
  ]);
  assert.match(csv, /employee_number,first_name,last_name,pay_rate_type,pay_rate,hours_worked,entity,role/);
  assert.match(csv, /E-14,Ada,Lovelace,hourly,18\.00,9\.00,Kitchen,server/);
  assert.match(csv, /regular_hours/);
  assert.doesNotMatch(csv, /net pay|paycheck|tax/i);
});

test("a name-only staff row still exports", () => {
  const row: PayrollRow = {
    employeeId: "e2",
    name: "Alex",
    role: "kitchen",
    operatorId: "host",
    operatorName: "House",
    regularHours: 4,
    otHours: 0,
    otFlag: false,
    otDaily: false,
    otWeekly: false,
    otSeventh: false,
    tipsCents: 0,
    salesCents: 0,
    punchCount: 1,
  };
  const csv = payrollCsv([row]);
  assert.match(csv, /,Alex,,,,4\.00,House,kitchen,Alex/);
});

test("the staff form requires a name, an employee number, and a pay rate", () => {
  assert.equal(
    validateStaffPay({ firstName: "", lastName: "Lovelace", employeeNumber: "1", payAmount: "15" }),
    "First name is required.",
  );
  assert.equal(
    validateStaffPay({ firstName: "Ada", lastName: "", employeeNumber: "1", payAmount: "15" }),
    "Last name is required.",
  );
  assert.equal(
    validateStaffPay({ firstName: "Ada", lastName: "Lovelace", employeeNumber: " ", payAmount: "15" }),
    "Employee number is required.",
  );
  assert.equal(
    validateStaffPay({ firstName: "Ada", lastName: "Lovelace", employeeNumber: "1", payAmount: "" }),
    "Pay rate is required.",
  );
  assert.equal(
    validateStaffPay({ firstName: "Ada", lastName: "Lovelace", employeeNumber: "1", payAmount: "15.50" }),
    null,
  );
});

test("venue and entity staff forms show the pay fields", () => {
  const fields = readFileSync("src/components/pos/StaffPayFields.tsx", "utf8");
  assert.match(fields, /First name/);
  assert.match(fields, /Last name/);
  assert.match(fields, /Employee number/);
  assert.match(fields, /Hourly/);
  assert.match(fields, /Salary/);
  const venue = readFileSync("src/components/platform/TenantUsersPanel.tsx", "utf8");
  const entity = readFileSync("src/components/pos/OperatorOpsView.tsx", "utf8");
  assert.match(venue, /StaffPayFields/);
  assert.match(venue, /Add floor staff/);
  assert.match(entity, /StaffPayFields/);
  assert.match(entity, /staffListTitle/);
  const migration = readFileSync("migrations/0060_staff_payroll.sql", "utf8");
  assert.match(migration, /employee_number/);
  assert.match(migration, /last word|\\\\s\+\\\\S\+\$|regexp_replace/);
});

test("the operators guide explains the employee number and the pay rate", () => {
  const hr = readFileSync("src/lib/guide/content/hr.ts", "utf8");
  assert.match(hr, /employee number unique at this venue/);
  assert.match(hr, /2,080/);
  assert.match(hr, /Summex does not process payroll/);
  const guide = readFileSync("docs/operators-guide.md", "utf8");
  assert.match(guide, /Guide v2026\.10\.292/);
  assert.match(guide, /employee number unique at the venue/);
});
