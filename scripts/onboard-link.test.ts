import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ENTITY_ONBOARD_STEPS,
  entityOnboardExcludesHostWork,
  entityOnboardingLinkCopy,
  finixStatusLabel,
  onboardLinkExpiresAt,
  onboardLinkStatus,
  onboardLinkStatusLabel,
  venueIsHostMerchant,
  venueOnboardGate,
  venueOnboardingLinkCopy,
} from "../src/lib/saas/onboard-link.ts";

const DAY = 24 * 60 * 60 * 1000;

test("onboarding link status moves sent, started, completed, and expired", () => {
  const now = Date.parse("2026-10-22T12:00:00.000Z");
  const expiresAt = new Date(now + 14 * DAY).toISOString();
  assert.equal(onboardLinkStatus({ sentAt: new Date(now).toISOString(), expiresAt }, now), "sent");
  assert.equal(onboardLinkStatusLabel("sent"), "Link sent");
  assert.equal(
    onboardLinkStatus({ sentAt: new Date(now).toISOString(), openedAt: new Date(now).toISOString(), expiresAt }, now),
    "started",
  );
  assert.equal(onboardLinkStatusLabel("started"), "Started");
  assert.equal(
    onboardLinkStatus({
      sentAt: new Date(now).toISOString(),
      completedAt: new Date(now).toISOString(),
      expiresAt: new Date(now - DAY).toISOString(),
    }, now),
    "completed",
  );
  assert.equal(onboardLinkStatusLabel("completed"), "Completed");
  assert.equal(
    onboardLinkStatus({ sentAt: new Date(now).toISOString(), expiresAt: new Date(now).toISOString() }, now),
    "expired",
  );
  assert.equal(
    onboardLinkStatus({ sentAt: new Date(now).toISOString(), revokedAt: new Date(now).toISOString(), expiresAt }, now),
    "expired",
  );
  assert.equal(onboardLinkStatusLabel("expired"), "Expired");
  assert.equal(onboardLinkStatus({}, now), "unsent");
});

test("links expire 14 days after they are issued", () => {
  const from = Date.parse("2026-10-08T00:00:00.000Z");
  const expiresAt = onboardLinkExpiresAt(from);
  assert.equal(expiresAt, "2026-10-22T00:00:00.000Z");
  assert.equal(onboardLinkStatus({ sentAt: new Date(from).toISOString(), expiresAt }, from + 14 * DAY - 1), "sent");
  assert.equal(onboardLinkStatus({ sentAt: new Date(from).toISOString(), expiresAt }, from + 14 * DAY), "expired");
});

test("host merchant gate requires the agreement and Finix, and a peer venue skips both", () => {
  assert.equal(venueIsHostMerchant("host_operators"), true);
  assert.equal(venueIsHostMerchant("single"), true);
  assert.equal(venueIsHostMerchant("hosted"), true);
  assert.equal(venueIsHostMerchant("single_operator"), true);
  assert.equal(venueIsHostMerchant("peer_venue"), false);
  assert.equal(venueIsHostMerchant(""), true);

  const host = venueOnboardGate({ hostMerchant: true, hasLocation: true });
  assert.equal(host.ok, false);
  assert.deepEqual(host.missing, ["Summex merchant agreement", "Finix merchant onboarding"]);

  const agreed = venueOnboardGate({
    hostMerchant: true,
    hasLocation: true,
    agreementAt: "2026-10-22T00:00:00.000Z",
    finixStarted: true,
  });
  assert.equal(agreed.ok, true);

  const peer = venueOnboardGate({ hostMerchant: false });
  assert.equal(peer.ok, true);
  assert.deepEqual(peer.missing, []);
  assert.equal(finixStatusLabel(null, false), "Not a host merchant");
  assert.equal(finixStatusLabel("APPROVED", true), "APPROVED");
});

test("entity onboarding does not include host Finix or venue settings", () => {
  assert.equal(entityOnboardExcludesHostWork(), true);
  assert.equal(ENTITY_ONBOARD_STEPS.some((step) => step.id === "finix" || step.id === "agreement"), false);
  const mail = entityOnboardingLinkCopy({
    entityName: "Steam Distillery",
    venueName: "The Laundry",
    url: "https://app.summex.app/onboard/abc",
    username: "poc@steam.example",
    seatLabel: "Entity owner",
  });
  assert.match(mail.text, /only for that selling entity/);
  assert.match(mail.text, /does not include host Finix/);
  assert.match(mail.text, /14 days/);
  assert.doesNotMatch(mail.text, /One-time password/i);
  assert.doesNotMatch(mail.text, /Temporary password/i);
});

test("venue link email is the onboarding URL, not a one-time password", () => {
  const mail = venueOnboardingLinkCopy({
    venueName: "Summit Hall",
    url: "https://app.summex.app/onboard/venue-token",
    username: "owner@summit.example",
  });
  assert.match(mail.text, /\/onboard\/venue-token/);
  assert.match(mail.text, /Set your password/);
  assert.match(mail.text, /Summex merchant agreement/);
  assert.match(mail.text, /not the Summex control plane/);
  assert.doesNotMatch(mail.text, /One-time password/i);
  assert.doesNotMatch(mail.text, /Temporary password/i);
});

test("contract provisioning and the public route send onboarding links", () => {
  const login = readFileSync("src/lib/saas/subscriber-login.server.ts", "utf8");
  assert.match(login, /issueVenueOnboardingLink/);
  assert.match(login, /sent = result\.status === "sent"/);
  assert.doesNotMatch(login, /subscriberInviteCopy/);
  const users = readFileSync("src/lib/saas/tenant-users.server.ts", "utf8");
  assert.match(users, /issueEntityOnboardingLink/);
  assert.match(users, /scope: "entity"/);
  const route = readFileSync("src/routes/onboard.$token.tsx", "utf8");
  assert.match(route, /\/onboard\/\$token/);
  const screen = readFileSync("src/components/saas/OnboardLinkScreen.tsx", "utf8");
  assert.match(screen, /Set password and continue/);
  assert.match(screen, /Summex merchant agreement/);
  assert.match(screen, /does not include host Finix|Host Finix and venue-wide settings are not/);
  const tree = readFileSync("src/routeTree.gen.ts", "utf8");
  assert.match(tree, /'\/onboard\/\$token'/);
  const guide = readFileSync("src/lib/guide/content/saas.ts", "utf8");
  assert.match(guide, /expires in 14 days/);
  assert.match(guide, /Summex merchant agreement/);
  const types = readFileSync("src/lib/guide/types.ts", "utf8");
  assert.match(types, /GUIDE_VERSION = "2026\.10\.336"/);
});
