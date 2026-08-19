import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto("http://127.0.0.1:8080/online", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// Menu product cards: second grid (sm:grid-cols-2)
const cards = page.locator("main section .grid.sm\\:grid-cols-2 button, main section div.grid.gap-2.sm\\:grid-cols-2 > button");
let count = await cards.count();
if (count < 1) {
  // fallback: buttons that contain a price
  const all = page.locator("main button");
  const n = await all.count();
  let clicked = 0;
  for (let i = 0; i < n && clicked < 2; i++) {
    const t = await all.nth(i).innerText();
    if (t.includes("$") && !t.includes("Order ahead") && !t.includes("Pickup")) {
      await all.nth(i).click();
      clicked++;
    }
  }
  console.log("fallback clicked", clicked);
} else {
  console.log("menu cards", count);
  await cards.nth(0).click();
  await cards.nth(1).click();
}

await page.getByPlaceholder("Your name").fill("E2E Guest");
await page.getByPlaceholder("Mobile phone").fill("555-0100");
const fireSel = page.locator("aside select").first();
if (await fireSel.count()) {
  await fireSel.selectOption("on_arrival").catch(() => {});
}
await page.getByRole("button", { name: /^Place order$/i }).click();
await page.waitForURL(/\/order\//, { timeout: 10000 });
await page.waitForTimeout(1000);
const url = page.url();
const claim = (await page.locator(".font-mono").first().textContent())?.trim();
const orderNum = (await page.locator("h1").first().textContent())?.trim();
console.log(JSON.stringify({ step: "placed", url, claim, orderNum }));

// Check in via table QR
await page.goto("http://127.0.0.1:8080/table/12", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.getByRole("button", { name: /I ordered ahead/i }).click();
await page.getByPlaceholder(/Claim code/i).fill(claim);
await page.getByRole("button", { name: /Check in/i }).click();
await page.waitForTimeout(2000);
const after = page.url();
const body2 = await page.locator("body").innerText();
const kitchenMsg = body2.includes("kitchen") || body2.includes("Kitchen") || body2.includes("preparing") || body2.includes("In kitchen") || body2.includes("seated") || body2.includes("Checked");
await page.screenshot({ path: "/workspace/screenshots/e2e-checkin.png" });
console.log(JSON.stringify({ step: "checkin", url: after, kitchenMsg, snippet: body2.slice(0, 500), errors }));

// Curbside path quick
await page.goto("http://127.0.0.1:8080/online", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.getByRole("button", { name: /^Curbside/i }).click();
const product = page.locator("main button").filter({ hasText: "$" }).first();
await product.click();
await page.getByPlaceholder("Your name").fill("Curb Guest");
await page.getByPlaceholder("Vehicle").fill("Tesla Model Y");
await page.getByPlaceholder("Color").fill("White");
await page.getByRole("button", { name: /^Place order$/i }).click();
await page.waitForTimeout(1500);
const curbUrl = page.url();
const curbBody = (await page.locator("body").innerText()).slice(0, 400);
console.log(JSON.stringify({ step: "curbside", curbUrl, curbBody, errors }));

await browser.close();
if (errors.length) process.exit(2);
if (!url.includes("/order/")) process.exit(3);
if (!claim) process.exit(4);
console.log("OK");
