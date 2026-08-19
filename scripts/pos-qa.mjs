import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push("PAGE: " + String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("CON: " + m.text());
});

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

// Login as server
await page.getByRole("button", { name: /Jordan Lee/i }).click();
await page.waitForTimeout(1000);
await page.screenshot({ path: "/workspace/screenshots/pos-floor.png" });

// Find table button - tables show label number
const tableBtns = page.locator("button").filter({ hasText: /^\s*1\s/ });
// Try clicking table with "2 top" near dining
const tables = page.locator("button").filter({ hasText: /top/i });
const count = await tables.count();
console.log("table-like buttons", count);
if (count > 2) {
  await tables.nth(2).click();
  await page.waitForTimeout(500);
}
const seatParty = page.getByRole("button", { name: /Seat party/i });
if (await seatParty.isVisible({ timeout: 2000 }).catch(() => false)) {
  await seatParty.click();
  await page.waitForTimeout(800);
}
await page.screenshot({ path: "/workspace/screenshots/pos-order.png" });

// Add Harbor Lager if on order view
const lager = page.getByRole("button", { name: /Harbor Lager/i });
if (await lager.isVisible({ timeout: 2000 }).catch(() => false)) {
  await lager.click();
  await page.waitForTimeout(300);
  // maybe soda
  const soda = page.getByRole("button", { name: /House Soda/i });
  if (await soda.isVisible().catch(() => false)) {
    // might open mod dialog
    await soda.click();
    await page.waitForTimeout(400);
    const addBtn = page.getByRole("button", { name: /^Add/i });
    if (await addBtn.isVisible().catch(() => false)) await addBtn.click();
  }
  await page.getByRole("button", { name: /^Send$/i }).click().catch(() => {});
  await page.waitForTimeout(400);
}
await page.screenshot({ path: "/workspace/screenshots/pos-order-items.png" });

// Kitchen nav - desktop side nav
await page.getByRole("button", { name: /Kitchen/i }).first().click();
await page.waitForTimeout(600);
await page.screenshot({ path: "/workspace/screenshots/pos-kitchen.png" });

// Reports
await page.getByRole("button", { name: /Reports/i }).first().click();
await page.waitForTimeout(600);
await page.screenshot({ path: "/workspace/screenshots/pos-reports.png" });

// Mobile
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("button", { name: /Floor/i }).first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: "/workspace/screenshots/pos-mobile.png" });

const text = await page.locator("body").innerText();
console.log(JSON.stringify({ errors, snippet: text.slice(0, 400) }, null, 2));
await browser.close();
