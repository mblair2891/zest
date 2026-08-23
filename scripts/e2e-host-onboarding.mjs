import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shotDir = join(root, "screenshots");
mkdirSync(shotDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

const shot = (name) => page.screenshot({ path: join(shotDir, name) });
const fail = async (msg) => {
  console.log("FAIL", msg);
  await shot("host-onboard-fail.png");
  console.log("body", (await page.locator("body").innerText()).slice(0, 1200));
  if (errors.length) console.log("pageerrors", errors);
  await browser.close();
  process.exit(1);
};

await page.goto("http://127.0.0.1:8080/platform", {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.evaluate(() => {
  localStorage.removeItem("zest-saas-v7");
  localStorage.removeItem("zest-pos-v5");
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(800);

await page.getByRole("button", { name: /Morgan Blair/i }).click();
await page.waitForTimeout(800);
await shot("host-onboard-01-platform.png");

const onboardBtn = page.getByRole("button", {
  name: /Onboard host \+ operators/i,
});
if (await onboardBtn.isVisible().catch(() => false)) {
  await onboardBtn.click();
} else {
  await page.getByRole("button", { name: /^Host setup$/i }).click();
}
await page.waitForTimeout(400);

await page.getByPlaceholder("New organization name").fill("Host Venue Co");
await page.getByRole("button", { name: /Create organization/i }).click();
await page.waitForTimeout(400);
const afterOrg = await page.locator("body").innerText();
if (!/Host Venue Co/.test(afterOrg)) {
  await fail("org not created");
}

await page.getByPlaceholder("Location name", { exact: true }).fill("Host Venue");
await page
  .getByPlaceholder("Host brand (defaults to location name)", { exact: true })
  .fill("Host Venue");
await page.getByRole("button", { name: /Create location/i }).click();
await page.waitForTimeout(500);
const afterLoc = await page.locator("body").innerText();
if (!/Host brand name/.test(afterLoc) && !/Host Venue/.test(afterLoc)) {
  await fail("location not created");
}
await shot("host-onboard-02-location.png");

await page.getByPlaceholder("Operator name").fill("Operator A");
await page
  .getByPlaceholder("Payout account label (placeholder)")
  .fill("Operator A checking");
await page.getByPlaceholder("Account last 4").fill("1111");
await page.getByRole("button", { name: /^Add operator$/i }).click();
await page.waitForTimeout(300);

await page.getByPlaceholder("Operator name").fill("Operator B");
await page
  .getByPlaceholder("Payout account label (placeholder)")
  .fill("Operator B operating");
await page.getByPlaceholder("Account last 4").fill("2222");
await page.getByRole("button", { name: /^Add operator$/i }).click();
await page.waitForTimeout(400);
const afterOps = await page.locator("body").innerText();
if (!/Operator A/.test(afterOps) || !/Operator B/.test(afterOps)) {
  await fail("operators not added");
}

await page.getByRole("button", { name: /Generate starter catalog/i }).click();
await page.waitForTimeout(500);
const afterMenu = await page.locator("body").innerText();
if (!/House cocktail/.test(afterMenu) || !/House plate/.test(afterMenu)) {
  await fail("starter catalog missing");
}
await shot("host-onboard-03-routing.png");

const openPos = page.getByRole("link", { name: /Open POS for Host Venue/i });
if (!(await openPos.isVisible().catch(() => false))) {
  await fail("Open POS link not ready");
}
await openPos.click();
await page.waitForTimeout(1000);

const loginBody = await page.locator("body").innerText();
if (!/Floor Server/.test(loginBody) || !/House Owner/.test(loginBody)) {
  await fail("POS login missing house staff");
}
await shot("host-onboard-04-pos-login.png");

await page.getByRole("button", { name: /House Owner/i }).click();
await page.waitForTimeout(1200);
await page
  .getByRole("button", { name: /^Got it$/i })
  .click({ timeout: 5000 })
  .catch(() => {});
await page.waitForTimeout(400);
await shot("host-onboard-04b-floor.png");

const barTab = page.getByRole("button", { name: /Open bar tab/i });
if (await barTab.isVisible().catch(() => false)) {
  await barTab.click();
  await page.getByPlaceholder("Guest name").fill("Guest");
  await page.getByRole("button", { name: /^Open tab$/i }).click();
} else {
  const tableBtn = page.locator("button").filter({ hasText: /^1$/ }).first();
  if (await tableBtn.isVisible().catch(() => false)) {
    await tableBtn.click();
    await page.getByRole("button", { name: /Seat party/i }).click();
  } else {
    await fail("could not open a check (no floor / bar tab)");
  }
}
await page.waitForTimeout(700);

const orderBody = await page.locator("body").innerText();
if (!/Operator A/.test(orderBody) || !/Operator B/.test(orderBody)) {
  await fail("order screen missing operators");
}

await page.getByRole("button", { name: "Operator A", exact: true }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: /House cocktail/i }).first().click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: "Operator B", exact: true }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: /House plate/i }).first().click();
await page.waitForTimeout(300);
await shot("host-onboard-05-check.png");

const checkText = await page.locator("body").innerText();
if (!/House cocktail/.test(checkText) || !/House plate/.test(checkText)) {
  await fail("check missing both operators' items");
}

await page.getByRole("button", { name: /^Send$/i }).click();
await page.waitForTimeout(400);

const routed = await page.evaluate(() => {
  const raw = localStorage.getItem("zest-pos-v5");
  if (!raw) return null;
  const tickets = JSON.parse(raw)?.state?.tickets ?? [];
  return tickets.map((t) => ({
    station: t.station,
    vendorName: t.vendorName,
    items: (t.items ?? []).map((i) => i.name),
  }));
});
console.log("tickets", JSON.stringify(routed));
const hasBar = (routed ?? []).some(
  (t) => t.station === "bar" && /Operator A|cocktail/i.test(JSON.stringify(t)),
);
const hasKit = (routed ?? []).some(
  (t) => t.station === "kitchen" && /Operator B|plate/i.test(JSON.stringify(t)),
);
if (!hasBar || !hasKit) {
  await fail("tickets did not split to bar (A) and kitchen (B): " + JSON.stringify(routed));
}

await page.getByRole("button", { name: /Pay/i }).click();
await page.waitForTimeout(400);
const payDlg = await page.locator("[role=dialog]").innerText();
if (!/Zest Payments/.test(payDlg) || !/Host Venue/.test(payDlg)) {
  await fail("pay dialog missing host brand / Zest Payments");
}
await shot("host-onboard-06-pay.png");
await page.getByRole("button", { name: /Charge card/i }).click();
await page.waitForTimeout(600);
if (await page.getByRole("button", { name: /^Done$/i }).isVisible()) {
  await page.getByRole("button", { name: /^Done$/i }).click();
}
await page.waitForTimeout(500);

const settleNav = page.locator("nav").getByRole("button", { name: /Settle/i });
if (!(await settleNav.isVisible().catch(() => false))) {
  await fail("Settle nav missing");
}
await settleNav.click();
await page.waitForTimeout(700);
const settle = await page.locator("body").innerText();
if (!/Operator A/.test(settle) || !/Operator B/.test(settle)) {
  await fail("settlement missing operators");
}
if (!/1111/.test(settle) || !/2222/.test(settle)) {
  await fail("settlement missing payout placeholders");
}
if (!/Host Venue/.test(settle)) {
  await fail("settlement missing host brand");
}
await shot("host-onboard-07-settlement.png");

await page.getByRole("button", { name: /Close period/i }).click();
await page.waitForTimeout(500);
const closed = await page.locator("body").innerText();
if (!/Period closed|Closed periods|electronic payout/i.test(closed)) {
  await fail("period close failed");
}
await shot("host-onboard-08-closed.png");

if (errors.length) {
  await fail("page errors: " + errors.join(" | "));
}

console.log("PASS host multi-operator onboarding");
await browser.close();
process.exit(0);
