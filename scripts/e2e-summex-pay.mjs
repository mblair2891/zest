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
    if (k.startsWith("summex-") || k.startsWith("zest-")) localStorage.removeItem(k);
  }
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1000);

await page.getByRole("button", { name: /Morgan Blair/i }).click();
await page.waitForTimeout(1200);
const gotIt = page.getByRole("button", { name: /^Got it$/i });
if (await gotIt.isVisible().catch(() => false)) await gotIt.click();
await page.keyboard.press("Escape").catch(() => {});
await page.waitForTimeout(400);

await page.evaluate(() => {
  const clickLabel = (label) => {
    const btns = [...document.querySelectorAll("button")];
    const b = btns.find((el) => el.textContent?.trim() === label);
    b?.click();
    return !!b;
  };
  window.__clickedInteg = clickLabel("Integrations");
});
await page.waitForTimeout(800);
await page.screenshot({ path: "/workspace/screenshots/summex-payments.png" });

const body = await page.locator("body").innerText();
const hasSummex = /Summex Payments/i.test(body);
const hasStripe = /\bStripe Payments\b|\bSquare Payments\b/.test(body);
const builtIn = /not a partner you pick|built into Summex/i.test(body);

await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button")];
  btns.find((el) => el.textContent?.trim() === "Guests")?.click();
});
await page.waitForTimeout(700);
await page.screenshot({ path: "/workspace/screenshots/summex-gifts.png" });
const guestsText = await page.locator("body").innerText();
const giftLedger = /Summex gift ledger|First-party/i.test(guestsText);

const result = {
  hasSummex,
  hasStripe,
  builtIn,
  giftLedger,
  errors: errors.slice(0, 8),
  snippet: body.slice(0, 400).replace(/\s+/g, " "),
};
console.log(JSON.stringify(result, null, 2));
await browser.close();
process.exit(hasSummex && !hasStripe && giftLedger && errors.length === 0 ? 0 : 1);
