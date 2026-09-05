import test from "node:test";
import assert from "node:assert/strict";

function allocateByShare(total, weights) {
  if (total <= 0 || !weights.length) return weights.map(() => 0);
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum <= 0) return weights.map(() => 0);
  const out = weights.map((w) => Math.round((total * w) / sum));
  const drift = out.reduce((s, n) => s + n, 0) - total;
  out[out.length - 1] = (out[out.length - 1] ?? 0) - drift;
  if ((out[out.length - 1] ?? 0) < 0) {
    out[out.length - 1] = 0;
  }
  return out;
}

function entityIdForLine(line) {
  const v = String(line.vendorId ?? "").trim();
  if (!v || v === "host" || v === "unknown") return "host";
  return v;
}

function groupLinesByEntity(lines, hostName) {
  const order = [];
  const buckets = new Map();
  for (const line of lines) {
    const entityId = entityIdForLine(line);
    let bucket = buckets.get(entityId);
    if (!bucket) {
      bucket = {
        entityId,
        displayName: entityId === "host" ? hostName || "Host" : String(line.vendorName || entityId),
        lines: [],
      };
      buckets.set(entityId, bucket);
      order.push(entityId);
    }
    bucket.lines.push(line);
  }
  return order.map((id) => buckets.get(id));
}

function money(cents) {
  return (cents / 100).toFixed(2);
}

function guestCheckText(vendors, totals) {
  const lines = ["The Laundry", ""];
  for (const v of vendors) {
    if (vendors.length > 1) lines.push(v.displayName);
    for (const l of v.lines) {
      const pad = vendors.length > 1 ? "  " : "";
      lines.push(`${pad}${l.name.padEnd(18).slice(0, 22)} ${money(l.amountCents)}`);
    }
  }
  lines.push("");
  lines.push(`Subtotal ${money(totals.subtotal)}`);
  if (totals.tax) lines.push(`Tax ${money(totals.tax)}`);
  if (totals.tip) lines.push(`Tip ${money(totals.tip)}`);
  lines.push(`Total ${money(totals.total)}`);
  lines.push("Card: one authorization, split to the vendors above. Quantum Payments · Summex.");
  return lines.join("\n");
}

test("fee allocation sums to the tender", () => {
  const merch = [700, 300];
  const tax = allocateByShare(80, merch);
  const tip = allocateByShare(200, merch);
  assert.equal(tax.reduce((s, n) => s + n, 0), 80);
  assert.equal(tip.reduce((s, n) => s + n, 0), 200);
  assert.equal(tax[0], 56);
  assert.equal(tax[1], 24);
});

test("single entity takes the whole tender", () => {
  const parts = allocateByShare(1234, [500]);
  assert.deepEqual(parts, [1234]);
});

test("remainder pennies land on the last brand", () => {
  const parts = allocateByShare(100, [1, 1, 1]);
  assert.equal(parts.reduce((s, n) => s + n, 0), 100);
  assert.equal(parts[0], 33);
  assert.equal(parts[1], 33);
  assert.equal(parts[2], 34);
});

test("Diamond BBQ food + Steam Distillery drinks split by merch owner", () => {
  const diamond = 1800 + 600;
  const steam = 1400 + 700;
  const merch = [diamond, steam];
  const tax = 450;
  const tip = 800;
  const taxParts = allocateByShare(tax, merch);
  const tipParts = allocateByShare(tip, merch);
  const merchParts = allocateByShare(diamond + steam, merch);
  assert.deepEqual(merchParts, [diamond, steam]);
  assert.equal(taxParts.reduce((s, n) => s + n, 0), tax);
  assert.equal(tipParts.reduce((s, n) => s + n, 0), tip);
  const diamondTotal = merchParts[0] + taxParts[0] + tipParts[0];
  const steamTotal = merchParts[1] + taxParts[1] + tipParts[1];
  assert.equal(diamondTotal + steamTotal, diamond + steam + tax + tip);
  assert.ok(diamondTotal > steamTotal);
});

test("guest receipt groups by vendor then totals", () => {
  const groups = groupLinesByEntity(
    [
      { name: "Brisket", vendorId: "diamond", vendorName: "Diamond House BBQ", amountCents: 1800 },
      { name: "Beans", vendorId: "diamond", vendorName: "Diamond House BBQ", amountCents: 600 },
      { name: "Old Fashioned", vendorId: "steam", vendorName: "Steam Distillery", amountCents: 1400 },
      { name: "Beer", vendorId: "steam", vendorName: "Steam Distillery", amountCents: 700 },
    ],
    "The Laundry",
  );
  assert.equal(groups.length, 2);
  assert.equal(groups[0].displayName, "Diamond House BBQ");
  assert.equal(groups[1].displayName, "Steam Distillery");
  const text = guestCheckText(groups, { subtotal: 4500, tax: 0, tip: 0, total: 4500 });
  assert.match(text, /Diamond House BBQ/);
  assert.match(text, / {2}Brisket/);
  assert.match(text, /Steam Distillery/);
  assert.match(text, / {2}Old Fashioned/);
  assert.match(text, /one authorization, split to the vendors above/);
  assert.doesNotMatch(text, /Finix/i);
});

test("untagged lines land on the host", () => {
  const groups = groupLinesByEntity(
    [{ name: "Cover", vendorId: null, amountCents: 200 }],
    "Host Venue",
  );
  assert.equal(groups[0].entityId, "host");
  assert.equal(groups[0].displayName, "Host Venue");
});
