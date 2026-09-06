import { HELP_CHUNKS, HELP_PACK_VERSION } from "./guide-pack";
import { selectHelpChunks, type HelpChunk } from "./retrieve";
import { looksLikeTicketDump, scrubHelpQuestion } from "./scrub";

export type HelpAskInput = {
  question: string;
  role: string;
  screen: string;
  deviceRole: string;
  venueName: string;
  entityName: string;
  tableLabel: string;
  peerVenue: boolean;
  hostMulti: boolean;
  qrMode: string;
  cashModel: string;
  paymentsLive: boolean;
  demoPins: boolean;
  allowedViews: string[];
  platformAdmin: boolean;
};

export type HelpAnswer = {
  steps: string[];
  note: string;
  blocked: boolean;
  whoCan: string | null;
  sources: string[];
  usedAi: boolean;
  packVersion: string;
};

const ROLE_GUIDE: Record<string, string[]> = {
  owner: ["owner_manager"],
  manager: ["owner_manager"],
  accountant: ["owner_manager"],
  server: ["server"],
  host: ["server"],
  busser: ["server"],
  cashier: ["server"],
  bartender: ["kitchen_bar"],
  kitchen: ["kitchen_bar"],
  vendor_operator: ["vendor_operator"],
  kiosk: ["server"],
  platform_admin: ["platform_admin"],
};

function guideRolesFor(role: string, platformAdmin: boolean): string[] {
  if (platformAdmin || role === "platform_admin") return ["platform_admin"];
  return ROLE_GUIDE[role] ?? [];
}

function contextBlock(d: HelpAskInput): string {
  const lines = [
    `Venue: ${d.venueName || "this house"}`,
    d.peerVenue ? "Model: shared venue (peers). No host merchant. Do not invent a host entity." : d.hostMulti ? "Model: host + operators." : "Model: single operator.",
    d.entityName ? `Entity on this station: ${d.entityName}` : "",
    `Staff role: ${d.role || "unsigned (PIN pad)"}`,
    `Device: ${d.deviceRole || "unknown"}`,
    `Screen: ${d.screen || "unknown"}`,
    d.tableLabel ? `Focused table: ${d.tableLabel}` : "",
    `QR: ${d.qrMode || "unset"}`,
    `Cash: ${d.cashModel || "unset"}`,
    `Live cards: ${d.paymentsLive ? "possible if a reader is enrolled" : "training/sandbox — do not invent a live Visa"}`,
    `Demo PIN 0000: ${d.demoPins ? "demo only" : "off — never tell them 0000"}`,
    `This role may open: ${d.allowedViews.join(", ") || "(PIN pad only)"}`,
  ];
  return lines.filter(Boolean).join("\n");
}

function formatChunks(chunks: HelpChunk[]): string {
  return chunks
    .slice(0, 6)
    .map((c) => {
      const steps = c.steps.length ? `\nSteps: ${c.steps.map((s, i) => `${i + 1}. ${s}`).join(" ")}` : "";
      return `## ${c.title}\n${c.summary}\n${c.text.slice(0, 900)}${steps}`;
    })
    .join("\n\n");
}

function fallbackAnswer(chunks: HelpChunk[], question: string, d: HelpAskInput): HelpAnswer {
  const top = chunks[0];
  const steps = top?.steps.slice(0, 8) ?? [];
  const sources = chunks.slice(0, 3).map((c) => c.title);
  const blockedAsk = /settings|crm|pipeline|factory reset|tenant wipe|billing key/i.test(question);
  const canSettings = d.allowedViews.some((v) => /settings/i.test(v)) || d.platformAdmin;
  if (blockedAsk && !canSettings && !d.platformAdmin) {
    return {
      steps: [],
      note: "That is not available on this login. Ask an owner or manager (back office). Floor PIN cannot open Settings or platform CRM.",
      blocked: true,
      whoCan: "owner or manager",
      sources,
      usedAi: false,
      packVersion: HELP_PACK_VERSION,
    };
  }
  const note = top
    ? `From the Operators Guide (${top.title}). AI is not on in this environment — these are the written steps, not a live walkthrough.`
    : "Nothing in the Operators Guide matched that question for this role. Ask an owner or manager, or open Guide in the header.";
  return {
    steps: steps.length ? steps : top ? [top.summary] : [],
    note,
    blocked: false,
    whoCan: null,
    sources,
    usedAi: false,
    packVersion: HELP_PACK_VERSION,
  };
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence?.[1]?.trim() ?? trimmed;
  const start = body.search(/\{/);
  if (start < 0) return null;
  try {
    return JSON.parse(body.slice(start));
  } catch {
    const end = body.lastIndexOf("}");
    if (end > start) {
      try {
        return JSON.parse(body.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function callModel(
  messages: Array<{ role: "system" | "user"; content: string }>,
): Promise<string | null> {
  const key = process.env.XAI_API_KEY?.trim();
  if (!key) return null;
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      temperature: 0.1,
      max_tokens: 700,
      messages,
    }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return body.choices?.[0]?.message?.content ?? null;
}

export async function answerHelp(raw: HelpAskInput): Promise<HelpAnswer> {
  const question = scrubHelpQuestion(raw.question);
  if (!question) {
    return {
      steps: [],
      note: "Ask how to do a task on this screen.",
      blocked: false,
      whoCan: null,
      sources: [],
      usedAi: false,
      packVersion: HELP_PACK_VERSION,
    };
  }
  if (looksLikeTicketDump(question)) {
    return {
      steps: [],
      note: "Help does not take check contents or card numbers. Ask the task (for example: how do I seat a table?).",
      blocked: true,
      whoCan: null,
      sources: [],
      usedAi: false,
      packVersion: HELP_PACK_VERSION,
    };
  }
  const includePlatform = Boolean(raw.platformAdmin);
  const roles = guideRolesFor(raw.role, includePlatform);
  const chunks = selectHelpChunks(HELP_CHUNKS, question, roles, {
    includePlatform,
    screen: raw.screen,
    limit: 6,
  });
  const sources = chunks.slice(0, 4).map((c) => c.title);
  const ai = await callModel([
    {
      role: "system",
      content: `You are Summex in-app Help. You walk THIS screen, not a second manual.
Answer ONLY from the Operators Guide excerpts and the location facts below.
Return ONLY JSON: {"steps":["..."],"note":"...","blocked":false,"whoCan":null}
Rules:
- Numbered steps must match this UI (tap Floor, tap the table, Seat). Short imperative lines.
- If this role cannot do it, blocked=true, whoCan= who can (manager / owner / other entity), steps=[].
- Never invent Finix live cards. Guest cards are Quantum Payments. If live cards are off, say training/sandbox.
- Never invent a host entity on a shared venue. Never invent demo PIN 0000 unless demoPins is true.
- Cost variance flags compare invoices received to recipe × tickets for THAT entity only. Never call it theft. They record a reason: event, owner take-home, breakage, mis-ring, or a theft review.
- Platform CRM is not for servers. Do not mention pipeline, tenants wipe, or factory reset to floor staff.
- Do not ask for or repeat PANs, PINs, or ticket line items.
- If the guide does not cover it, say so — do not guess.`,
    },
    {
      role: "user",
      content: `${contextBlock(raw)}\n\nQuestion: ${question}\n\nOperators Guide excerpts:\n${formatChunks(chunks)}`,
    },
  ]);
  if (!ai) return fallbackAnswer(chunks, question, raw);
  const parsed = extractJson(ai);
  const o = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  if (!o) return fallbackAnswer(chunks, question, raw);
  const steps = Array.isArray(o.steps)
    ? o.steps.map((s) => String(s).trim()).filter(Boolean).slice(0, 10)
    : [];
  return {
    steps,
    note: String(o.note ?? "").trim().slice(0, 400),
    blocked: Boolean(o.blocked),
    whoCan: o.whoCan ? String(o.whoCan).slice(0, 80) : null,
    sources,
    usedAi: true,
    packVersion: HELP_PACK_VERSION,
  };
}
