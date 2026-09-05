import test from "node:test";
import assert from "node:assert/strict";
import { looksLikeTicketDump, scrubHelpQuestion, tokenizeHelpQuery } from "../src/lib/help/scrub.ts";
import { chunkVisibleTo, selectHelpChunks, type HelpChunk } from "../src/lib/help/retrieve.ts";

const chunks: HelpChunk[] = [
  {
    id: "role-server",
    title: "Server / floor",
    summary: "Tables, checks, send, pay.",
    roles: ["server"],
    visibility: "public",
    keywords: ["server", "floor", "seat"],
    text: "Tap Floor. Tap a table. Seat. Add items. Send.",
    steps: ["PIN in.", "Tap Floor, tap the table, Seat.", "Add items. Send."],
    openView: "floor",
  },
  {
    id: "platform-crm",
    title: "CRM (accounts, contacts, deals)",
    summary: "Leads and pipeline.",
    roles: ["platform_admin"],
    visibility: "platform",
    keywords: ["crm", "lead", "pipeline"],
    text: "Platform → CRM. Add lead.",
    steps: ["Open CRM.", "Add lead."],
    openView: "hq",
  },
];

test("scrub strips PAN-like digits and PIN phrases", () => {
  const out = scrubHelpQuestion("pay with 4111 1111 1111 1111 pin 1234");
  assert.equal(out.includes("4111"), false);
  assert.match(out, /\[card\]/i);
  assert.doesNotMatch(out, /\b1234\b/);
});

test("ticket dumps are rejected", () => {
  assert.equal(looksLikeTicketDump("$12 brisket $8 beans $4 tea $3 pie"), true);
  assert.equal(looksLikeTicketDump("how do I seat table 12"), false);
});

test("servers cannot retrieve platform CRM", () => {
  assert.equal(chunkVisibleTo(chunks[1]!, ["server"], false), false);
  const picked = selectHelpChunks(chunks, "crm pipeline lead", ["server"], {
    includePlatform: false,
  });
  assert.equal(
    picked.some((c) => c.id === "platform-crm"),
    false,
  );
});

test("seat query returns server floor steps", () => {
  const picked = selectHelpChunks(chunks, "how do I seat a table", ["server"], {
    includePlatform: false,
    screen: "floor",
  });
  assert.equal(picked[0]?.id, "role-server");
  assert.ok(picked[0]?.steps.some((s) => /Seat/i.test(s)));
});

test("tokenize drops stopwords", () => {
  assert.deepEqual(tokenizeHelpQuery("how do I seat a table"), ["seat", "table"]);
});
