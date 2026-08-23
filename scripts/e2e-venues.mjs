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
  localStorage.removeItem("summex-pos-v5");
  localStorage.removeItem("summex-saas-v6");
  localStorage.removeItem("summex-saas-v7");
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);

const home = await page.locator("body").innerText();
const needed = [
  "Full-service restaurant",
  "Food hall",
  "Truck pod",
  "Ghost kitchen",
  "Catering",
  "Bar & lounge",
  "Café / bakery",
  "Quick service",
  "SaaS platform",
];
const missing = needed.filter((n) => !home.includes(n));
await page.screenshot({ path: "/workspace/screenshots/venues-home.png" });
if (missing.length) {
  console.log("FAIL missing entities", missing, home.slice(0, 600));
  await browser.close();
  process.exit(2);
}

// Restaurant staff
await page.getByRole("link", { name: /Full-service restaurant/i }).click();
await page.waitForTimeout(800);
const rest = await page.locator("body").innerText();
if (!/Server · Dining/i.test(rest) || !/Jordan Lee/.test(rest)) {
  console.log("FAIL restaurant staff", rest.slice(0, 800));
  await browser.close();
  process.exit(2);
}
await page.screenshot({ path: "/workspace/screenshots/venues-restaurant.png" });

// Café staff
await page.getByRole("link", { name: /All venues/i }).click();
await page.waitForTimeout(500);
await page.getByRole("link", { name: /Café \/ bakery/i }).click();
await page.waitForTimeout(800);
const cafe = await page.locator("body").innerText();
if (!/Barista/i.test(cafe) || !/Baker/i.test(cafe) || !/Counter/i.test(cafe)) {
  console.log("FAIL cafe staff", cafe.slice(0, 800));
  await browser.close();
  process.exit(2);
}
await page.screenshot({ path: "/workspace/screenshots/venues-cafe.png" });

// Login as barista
await page.getByRole("button", { name: /Casey Brooks/i }).click();
await page.waitForTimeout(1200);
if (await page.getByRole("button", { name: /^Got it$/i }).isVisible().catch(() => false)) {
  await page.getByRole("button", { name: /^Got it$/i }).click();
  await page.waitForTimeout(300);
}
const logged = await page.locator("body").innerText();
if (!/Dockside/.test(logged) && !/Barista/i.test(logged)) {
  console.log("FAIL cafe login landing", logged.slice(0, 600));
}
await page.screenshot({ path: "/workspace/screenshots/venues-cafe-in.png" });
await page.getByRole("button", { name: /Sign out/i }).click();
await page.waitForTimeout(500);

// SaaS
await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.getByRole("link", { name: /SaaS platform/i }).click();
await page.waitForTimeout(800);
const saas = await page.locator("body").innerText();
if (!/Accountant/i.test(saas) || !/Support/i.test(saas) || !/Ops/i.test(saas)) {
  console.log("FAIL saas staff", saas.slice(0, 800));
  await browser.close();
  process.exit(2);
}
await page.screenshot({ path: "/workspace/screenshots/venues-saas.png" });

// Mobile home
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
mobile.on("pageerror", (e) => errors.push("mobile " + String(e)));
await mobile.goto("http://127.0.0.1:8080/", {
  waitUntil: "networkidle",
  timeout: 60000,
});
await mobile.waitForTimeout(800);
const overflow = await mobile.evaluate(
  () =>
    document.documentElement.scrollWidth >
    document.documentElement.clientWidth + 2,
);
await mobile.screenshot({ path: "/workspace/screenshots/venues-mobile.png" });
await mobile.close();

console.log(JSON.stringify({ missing, overflow, errors }, null, 2));
if (errors.length) {
  console.log(errors);
  await browser.close();
  process.exit(3);
}
if (overflow) {
  console.log("FAIL mobile overflow");
  await browser.close();
  process.exit(4);
}
await browser.close();
console.log("OK venues e2e");
