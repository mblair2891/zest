import { chromium } from "playwright";
import { mkdirSync } from "fs";
mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle", timeout: 60000 });
await page.evaluate(() => {
  localStorage.removeItem("zest-manual-prefs-v1");
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// Login as server
await page.getByRole("button", { name: /Jordan Lee/i }).click();
await page.waitForTimeout(1500);

const dialog = page.getByRole("dialog");
await dialog.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
const hasDialog = await dialog.isVisible().catch(() => false);
const dialogText = hasDialog ? await dialog.innerText() : "";
const hasOrderAhead = dialogText.toLowerCase().includes("order ahead");
const hasMarketing = dialogText.toLowerCase().includes("marketing hub");

await page.screenshot({ path: "/workspace/screenshots/whats-new-server.png" });

if (hasDialog) {
  await page.getByRole("button", { name: /Open full manual/i }).click();
  await page.waitForTimeout(900);
}
const manual = page.getByLabel("Zest user manual");
const manualOpen = await manual.isVisible().catch(() => false);
const manualText = manualOpen ? await manual.innerText() : "";
await page.screenshot({ path: "/workspace/screenshots/user-manual.png" });

if (manualOpen) {
  await page.getByLabel("Close manual").click();
  await page.waitForTimeout(500);
}

// Silence flow
await page.getByLabel("What is new").click();
await page.waitForTimeout(600);
const d2 = page.getByRole("dialog");
const d2vis = await d2.isVisible().catch(() => false);
if (d2vis) {
  // click the checkbox input
  await d2.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: /^Got it$/i }).click();
  await page.waitForTimeout(500);
}

await page.getByLabel("Sign out").click();
await page.waitForTimeout(900);
await page.getByRole("button", { name: /Jordan Lee/i }).click();
await page.waitForTimeout(1500);
const dialogAfterSilence = await page.getByRole("dialog").isVisible().catch(() => false);

await page.getByLabel("Sign out").click().catch(() => {});
await page.waitForTimeout(700);
await page.getByRole("button", { name: /Morgan Diaz/i }).click();
await page.waitForTimeout(1500);
const kitDialog = await page.getByRole("dialog").isVisible().catch(() => false);
const kitText = kitDialog ? await page.getByRole("dialog").innerText() : "";
const kitHasMarketing = kitText.toLowerCase().includes("marketing hub");
const kitHasKds = /kitchen|kds/i.test(kitText);

console.log(
  JSON.stringify(
    {
      hasDialog,
      hasOrderAhead,
      hasMarketingOnServer: hasMarketing,
      manualOpen,
      manualHasChapters: /chapter/i.test(manualText),
      dialogAfterSilence,
      kitDialog,
      kitHasMarketing,
      kitHasKds,
      dialogSnippet: dialogText.slice(0, 280),
      kitSnippet: kitText.slice(0, 280),
      errors: errors.slice(0, 8),
    },
    null,
    2,
  ),
);

await browser.close();
const ok =
  hasDialog &&
  hasOrderAhead &&
  !hasMarketing &&
  manualOpen &&
  dialogAfterSilence === false &&
  kitDialog &&
  !kitHasMarketing &&
  errors.length === 0;
process.exit(ok ? 0 : 2);
