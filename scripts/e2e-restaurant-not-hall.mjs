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

await page.goto("http://127.0.0.1:8080/", {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.evaluate(() => {
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith("summex-") || k.startsWith("zest-")) localStorage.removeItem(k);
  }
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1000);

await page.goto("http://127.0.0.1:8080/venue/food_hall", {
  waitUntil: "networkidle",
});
await page.waitForTimeout(900);
await page.getByRole("button", { name: /Morgan Blair/i }).click();
await page.waitForTimeout(1000);
const gotIt = page.getByRole("button", { name: /^Got it$/i });
if (await gotIt.isVisible().catch(() => false)) await gotIt.click();
await page.screenshot({ path: "/workspace/screenshots/fix-hall-session.png" });

await page.goto("http://127.0.0.1:8080/venue/restaurant", {
  waitUntil: "networkidle",
});
await page.waitForTimeout(1200);
const login = await page.locator("body").innerText();
await page.screenshot({ path: "/workspace/screenshots/fix-restaurant-login.png" });
if (!/Full-service restaurant/i.test(login)) {
  console.log("FAIL not restaurant login", login.slice(0, 700));
  await browser.close();
  process.exit(2);
}
if (/Market Hall/i.test(login)) {
  console.log("FAIL restaurant login still says Market Hall", login.slice(0, 500));
  await browser.close();
  process.exit(2);
}

await page.getByRole("button", { name: /Morgan Blair/i }).click();
await page.waitForTimeout(1200);
if (await gotIt.isVisible().catch(() => false)) await gotIt.click();

const body = await page.locator("body").innerText();
await page.screenshot({ path: "/workspace/screenshots/fix-restaurant.png" });

const bad = [];
if (/Hall settlement/i.test(body)) bad.push("hall settlement on restaurant");
if (/Summex Market Hall/i.test(body)) bad.push("market hall name");
if (!/Floor/i.test(body)) bad.push("no Floor");
if ((await page.getByRole("button", { name: /^Hall$/i }).count()) > 0)
  bad.push("Hall nav visible");
if ((await page.getByRole("button", { name: /^Settle$/i }).count()) > 0)
  bad.push("Settle nav visible");

console.log(JSON.stringify({ bad, errors, snippet: body.slice(0, 500) }, null, 2));
if (bad.length || errors.length) {
  await browser.close();
  process.exit(3);
}
await browser.close();
console.log("OK restaurant is not hall");
