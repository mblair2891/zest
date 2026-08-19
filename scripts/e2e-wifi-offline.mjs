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

await page.goto("http://127.0.0.1:8080/venue/restaurant", {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.evaluate(() => {
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith("zest-")) localStorage.removeItem(k);
  }
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);

await page.getByRole("button", { name: /Morgan Blair/i }).click();
await page.waitForTimeout(1000);
const gotIt = page.getByRole("button", { name: /^Got it$/i });
if (await gotIt.isVisible().catch(() => false)) await gotIt.click();

await page.getByRole("button", { name: /^Settings$/i }).click();
await page.waitForTimeout(600);
const settings = await page.locator("body").innerText();
if (!/WiFi first|House network/i.test(settings)) {
  console.log("FAIL no network panel", settings.slice(0, 500));
  await browser.close();
  process.exit(2);
}

await page.getByLabel(/Simulate internet outage/i).check();
await page.waitForTimeout(400);
const down = await page.locator("body").innerText();
if (!/Internet is out|no internet|WiFi up/i.test(down)) {
  console.log("FAIL no outage banner", down.slice(0, 600));
  await page.screenshot({ path: "/workspace/screenshots/wifi-fail.png" });
  await browser.close();
  process.exit(3);
}
await page.screenshot({ path: "/workspace/screenshots/wifi-offline.png" });

await page.getByRole("button", { name: /House network/i }).click();
await page.waitForTimeout(400);
const sheet = await page.locator("body").innerText();
if (!/Still works|Waits for internet|Zest-House/i.test(sheet)) {
  console.log("FAIL sheet missing", sheet.slice(0, 500));
  await browser.close();
  process.exit(4);
}
await page.screenshot({ path: "/workspace/screenshots/wifi-sheet.png" });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobile.goto("http://127.0.0.1:8080/venue/restaurant", {
  waitUntil: "networkidle",
});
await mobile.waitForTimeout(800);
if (await mobile.getByRole("button", { name: /Morgan Blair/i }).isVisible().catch(() => false)) {
  await mobile.getByRole("button", { name: /Morgan Blair/i }).click();
  await mobile.waitForTimeout(800);
}
const overflow = await mobile.evaluate(
  () =>
    document.documentElement.scrollWidth >
    document.documentElement.clientWidth + 2,
);
await mobile.screenshot({ path: "/workspace/screenshots/wifi-mobile.png" });
await mobile.close();

console.log(JSON.stringify({ errors, overflow }, null, 2));
if (errors.length || overflow) {
  await browser.close();
  process.exit(5);
}
await browser.close();
console.log("OK wifi offline");
