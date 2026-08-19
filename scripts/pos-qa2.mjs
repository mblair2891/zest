import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push("PAGE: " + String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("CON: " + m.text());
});

await page.goto("http://127.0.0.1:8080/");
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(800);

await page.getByRole("button", { name: /Jordan Lee/i }).click();
await page.waitForTimeout(900);

const seats = page.locator("button").filter({ hasText: "4 top" });
await seats.nth(0).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /Seat party/i }).click();
await page.waitForTimeout(800);

// Beer
await page.getByRole("button", { name: /Beer/i }).click();
await page.waitForTimeout(250);
await page.getByRole("button", { name: /Harbor Lager/i }).click();
await page.waitForTimeout(250);

// Mains
await page.getByRole("button", { name: /Mains/i }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: /Hearth Burger/i }).click();
await page.waitForTimeout(500);
const add = page.getByRole("button", { name: /^Add/i });
if (await add.isVisible().catch(() => false)) await add.click();
await page.waitForTimeout(300);

await page.getByRole("button", { name: /^Send$/i }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: "/workspace/screenshots/pos-order-items.png" });

// Click side nav by text content Kitchen
await page.locator("nav button", { hasText: "Kitchen" }).first().click();
await page.waitForTimeout(700);
await page.screenshot({ path: "/workspace/screenshots/pos-kitchen.png" });
const bump = page.getByRole("button", { name: /Bump/i }).first();
if (await bump.isVisible().catch(() => false)) await bump.click();

await page.locator("nav button", { hasText: "Order" }).first().click();
await page.waitForTimeout(600);
await page.getByRole("button", { name: /Pay/i }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: /Charge card/i }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: "/workspace/screenshots/pos-paid.png" });
const done = page.getByRole("button", { name: /^Done$/i });
if (await done.isVisible().catch(() => false)) await done.click();
await page.waitForTimeout(500);

await page.locator("nav button", { hasText: "Reports" }).first().click();
await page.waitForTimeout(900);
await page.screenshot({ path: "/workspace/screenshots/pos-reports.png" });

await page.setViewportSize({ width: 390, height: 844 });
await page.locator("nav button", { hasText: "Floor" }).first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: "/workspace/screenshots/pos-mobile.png" });

const body = await page.locator("body").innerText();
console.log(JSON.stringify({ errors: [...new Set(errors)], bodySlice: body.slice(0, 350) }, null, 2));
await browser.close();
