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

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle", timeout: 60000 });
await page.evaluate(() => localStorage.removeItem("summex-notify-v1"));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);

await page.getByRole("button", { name: /Morgan Blair/i }).click();
await page.waitForTimeout(1400);
if (await page.getByRole("dialog").isVisible().catch(() => false)) {
  const got = page.getByRole("button", { name: /^Got it$/i });
  if (await got.isVisible()) await got.click();
  await page.waitForTimeout(400);
}

const floor = page.getByRole("button", { name: /^Floor$/ });
if (await floor.isVisible()) await floor.click();
await page.waitForTimeout(400);

const tables = page.locator("button.absolute");
const n = await tables.count();
for (let i = 0; i < n; i++) {
  await tables.nth(i).click();
  await page.waitForTimeout(200);
  const seat = page.getByRole("button", { name: /Seat party/i });
  if (await seat.isVisible().catch(() => false)) {
    await seat.click();
    break;
  }
}
await page.waitForTimeout(500);

// close leftover modifier if any
if (await page.getByRole("button", { name: /^Add/i }).isVisible().catch(() => false)) {
  await page.keyboard.press("Escape");
}

await page.getByRole("button", { name: /Non-Alcoholic/i }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /House Soda/i }).click();
await page.waitForTimeout(300);
if (await page.getByRole("button", { name: /^Add/i }).isVisible().catch(() => false)) {
  await page.getByRole("button", { name: /^Add/i }).click();
}
await page.waitForTimeout(300);
await page.getByRole("button", { name: /^Send$/ }).click();
await page.waitForTimeout(500);
await page.locator("nav.hidden, nav").filter({ hasText: "OWNER MENU" }).getByRole("button", { name: /Bar/ }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: "/workspace/screenshots/bump-kds.png" });
const bump = page.getByRole("button", { name: /^Bump$/ });
const bumpN = await bump.count();
if (!bumpN) {
  const text = await page.locator("body").innerText();
  console.log("no bump", text.slice(0, 900));
  await browser.close();
  process.exit(2);
}
await bump.first().click();
await page.waitForTimeout(800);
await page.getByRole("button", { name: /Notifications/ }).click();
await page.waitForTimeout(400);
const inbox = await page.getByRole("dialog", { name: "Notifications" }).innerText();
await page.screenshot({ path: "/workspace/screenshots/bump-inbox.png" });
await page.getByLabel("Close notifications").click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: /^Floor$/ }).click();
await page.waitForTimeout(500);
const up = await page.getByText(/^Up$/i).count();
await page.screenshot({ path: "/workspace/screenshots/bump-floor-up.png" });
console.log(JSON.stringify({
  bumpN,
  inboxOk: /food up/i.test(inbox),
  inbox: inbox.slice(0, 320),
  up,
  errors,
}, null, 2));
await browser.close();
process.exit(/food up/i.test(inbox) && errors.length === 0 ? 0 : 2);
