import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const failed = [];
page.on("response", (r) => {
  if (r.status() === 404) failed.push(r.url());
});
await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
console.log(failed);
await browser.close();
