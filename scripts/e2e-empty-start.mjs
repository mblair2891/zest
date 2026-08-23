import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shotDir = join(root, "screenshots");
mkdirSync(shotDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

const shot = (name) => page.screenshot({ path: join(shotDir, name) });
const fail = async (msg) => {
  console.log("FAIL", msg);
  await shot("empty-start-fail.png");
  console.log("body", (await page.locator("body").innerText()).slice(0, 1500));
  if (errors.length) console.log("pageerrors", errors);
  await browser.close();
  process.exit(1);
};

await page.goto("http://127.0.0.1:8080/login", {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.evaluate(() => {
  localStorage.clear();
  sessionStorage.clear();
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(800);

const loginBody = await page.locator("body").innerText();
if (/Seaport|Morgan Blair|org_demo/i.test(loginBody)) {
  await fail("login page leaked demo tenant names");
}
if (!/Username/i.test(loginBody)) {
  await fail("login form missing");
}
await shot("empty-start-01-login.png");

await page.getByPlaceholder("Admin").fill("Admin");
await page.locator('input[type="password"]').fill("password");
await page.getByRole("button", { name: /Sign in/i }).click();
await page.waitForTimeout(2500);

const afterLogin = await page.locator("body").innerText();
if (/Seaport Collective|Morgan Blair/i.test(afterLogin)) {
  await fail("demo data after login");
}
if (!/Change your password|new password/i.test(afterLogin)) {
  await fail("did not force password change: " + afterLogin.slice(0, 400));
}
await shot("empty-start-02-change.png");

// reject reuse of bootstrap password
await page.locator('input[type="password"]').nth(0).fill("password");
await page.locator('input[type="password"]').nth(1).fill("password");
await page.locator('input[type="password"]').nth(2).fill("password");
await page.getByRole("button", { name: /Save password/i }).click();
await page.waitForTimeout(400);
const reject = await page.locator("body").innerText();
if (!/other than the initial|different/i.test(reject)) {
  await fail("should reject bootstrap password reuse");
}

await page.locator('input[type="password"]').nth(0).fill("password");
await page.locator('input[type="password"]').nth(1).fill("Newpass123");
await page.locator('input[type="password"]').nth(2).fill("Newpass123");
await page.getByRole("button", { name: /Save password/i }).click();
await page.waitForTimeout(2500);

const platform = await page.locator("body").innerText();
if (!/Platform/i.test(platform)) {
  await fail("did not reach platform after password change");
}
if (/Seaport|Morgan Blair|Zest Market Hall|Forge Bistro/i.test(platform)) {
  await fail("demo tenants still on platform: " + platform.slice(0, 500));
}
if (!/No organization|Create organization|Host setup/i.test(platform)) {
  await fail("expected empty org CTA: " + platform.slice(0, 500));
}
await shot("empty-start-03-platform.png");

if (errors.length) await fail("page errors " + errors.join(" | "));

console.log("PASS empty start + forced password change");
await browser.close();
process.exit(0);
