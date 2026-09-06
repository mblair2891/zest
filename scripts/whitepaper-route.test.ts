import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("/whitepaper route is not the Get-a-price wizard", () => {
  const route = readFileSync(join(root, "src/routes/whitepaper.tsx"), "utf8");
  const paper = readFileSync(
    join(root, "src/components/marketing/SubscriberWhitePaper.tsx"),
    "utf8",
  );
  const pricing = readFileSync(join(root, "src/routes/get-pricing.tsx"), "utf8");

  assert.equal(route.includes("IntakeWizard"), false);
  assert.equal(paper.includes("IntakeWizard"), false);
  assert.equal(route.includes("whitepaper.html"), false);
  assert.match(route, /SubscriberWhitePaper/);
  assert.match(pricing, /IntakeWizard/);
  assert.match(paper, /data-page="white-paper"/);
  assert.equal(paper.includes('type="email"'), false);
  assert.equal(paper.includes("<form"), false);
});
