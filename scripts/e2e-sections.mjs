import { chromium } from "playwright";
import { mkdirSync } from "fs";
mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

async function dismissWhatsNew() {
  await page.waitForTimeout(600);
  const dlg = page.getByRole("dialog");
  if (await dlg.isVisible().catch(() => false)) {
    const got = page.getByRole("button", { name: /^Got it$/i });
    if (await got.isVisible().catch(() => false)) await got.click();
    else await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
}

async function closeDialog() {
  const footer = page.getByRole("button", { name: /^Close$/i }).first();
  if (await footer.isVisible().catch(() => false)) await footer.click();
  else await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
}

async function tableBtn(label) {
  return page.locator("button.absolute").filter({
    has: page.locator("span.font-semibold", { hasText: new RegExp(`^${label}$`) }),
  });
}

await page.goto("http://127.0.0.1:8080/", {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.evaluate(() => {
  localStorage.removeItem("zest-pos-v5");
  localStorage.removeItem("zest-manual-prefs-v1");
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1000);

// Sam Okonkwo — Booth only (PIN 2222)
for (const d of ["2", "2", "2", "2"]) {
  await page.getByRole("button", { name: d, exact: true }).click();
}
await page.waitForTimeout(1200);
await dismissWhatsNew();

const floorNav = page.getByRole("button", { name: /^Floor$/ });
if (await floorNav.isVisible().catch(() => false)) await floorNav.click();
await page.waitForTimeout(400);

await page.screenshot({ path: "/workspace/screenshots/sections-sam-floor.png" });

// Dining table 3 should be blocked
const t3 = await tableBtn("3");
await t3.click();
await page.waitForTimeout(400);
const blocked = page.getByRole("dialog", { name: /Outside your section/i });
const blockedVisible = await blocked.isVisible().catch(() => false);
await page.screenshot({ path: "/workspace/screenshots/sections-blocked.png" });
if (!blockedVisible) {
  const body = await page.locator("body").innerText();
  console.log("FAIL: expected outside-section dialog for table 3\n", body.slice(0, 800));
  await browser.close();
  process.exit(2);
}
await closeDialog();

// Booth 12 is Sam's home section — should open seat
const t12 = await tableBtn("12");
await t12.click();
await page.waitForTimeout(400);
const seat = page.getByRole("button", { name: /Seat party/i });
const canSeatBooth = await seat.isVisible().catch(() => false);
if (!canSeatBooth) {
  const body = await page.locator("body").innerText();
  console.log("FAIL: Sam should seat booth 12\n", body.slice(0, 800));
  await browser.close();
  process.exit(2);
}
await page.getByRole("button", { name: /^Cancel$/i }).click();

await page.getByRole("button", { name: /Sign out/i }).click();
await page.waitForTimeout(600);

// Jordan Lee — Dining + grant on 12
await page.getByRole("button", { name: /Jordan Lee/i }).click();
await page.waitForTimeout(1200);
await dismissWhatsNew();
if (await floorNav.isVisible().catch(() => false)) await floorNav.click();
await page.waitForTimeout(400);

const grantBadge = await page.getByText(/^Grant$/i).count();
const t1 = await tableBtn("1");
await t1.click();
await page.waitForTimeout(400);
const jordanCanSeatDining = await page
  .getByRole("button", { name: /Seat party/i })
  .isVisible()
  .catch(() => false);
if (!jordanCanSeatDining) {
  console.log("FAIL: Jordan should seat dining");
  await browser.close();
  process.exit(2);
}
await page.getByRole("button", { name: /^Cancel$/i }).click();

// Bar seat should be blocked (no grant)
const b1 = await tableBtn("B1");
await b1.click();
await page.waitForTimeout(400);
const barBlocked = await page
  .getByRole("dialog", { name: /Outside your section/i })
  .isVisible()
  .catch(() => false);
if (!barBlocked) {
  console.log("FAIL: Jordan should be blocked on bar");
  await browser.close();
  process.exit(2);
}
await closeDialog();
await page.screenshot({
  path: "/workspace/screenshots/sections-jordan-floor.png",
});

await page.getByRole("button", { name: /Sign out/i }).click();
await page.waitForTimeout(600);

// Owner: Staff assignment + Settings policy
await page.getByRole("button", { name: /Morgan Blair/i }).click();
await page.waitForTimeout(1200);
await dismissWhatsNew();
await page.getByRole("button", { name: /^Staff$/ }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: "/workspace/screenshots/sections-staff.png" });
const staffText = await page.locator("body").innerText();
if (!/Dining/.test(staffText) || !/Booth/.test(staffText)) {
  console.log("FAIL: Staff view missing section chips");
  await browser.close();
  process.exit(2);
}

await page.getByRole("button", { name: /^Settings$/ }).click();
await page.waitForTimeout(400);
await page.screenshot({
  path: "/workspace/screenshots/sections-settings.png",
});
const settingsText = await page.locator("body").innerText();
if (!/Section control/.test(settingsText)) {
  console.log("FAIL: Settings missing Section control");
  await browser.close();
  process.exit(2);
}
if (!/Cannot enter orders in another section/.test(settingsText)) {
  console.log("FAIL: missing order limitation checkbox");
  await browser.close();
  process.exit(2);
}

// Mobile floor
const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
});
mobile.on("pageerror", (e) => errors.push("mobile " + String(e)));
await mobile.goto("http://127.0.0.1:8080/", {
  waitUntil: "networkidle",
  timeout: 60000,
});
await mobile.waitForTimeout(800);
if (await mobile.getByRole("button", { name: /Morgan Blair/i }).isVisible()) {
  await mobile.getByRole("button", { name: /Morgan Blair/i }).click();
  await mobile.waitForTimeout(1000);
  const got = mobile.getByRole("button", { name: /^Got it$/i });
  if (await got.isVisible().catch(() => false)) await got.click();
}
const overflow = await mobile.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
);
await mobile.screenshot({
  path: "/workspace/screenshots/sections-mobile.png",
});
await mobile.close();

console.log(
  JSON.stringify(
    {
      blockedVisible,
      canSeatBooth,
      jordanCanSeatDining,
      barBlocked,
      grantBadge,
      overflow,
      errors,
    },
    null,
    2,
  ),
);

if (errors.length) {
  console.log("console errors", errors);
  await browser.close();
  process.exit(3);
}
if (overflow) {
  console.log("FAIL: mobile overflow");
  await browser.close();
  process.exit(4);
}

await browser.close();
console.log("OK sections e2e");
