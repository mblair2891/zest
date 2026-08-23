import { heuristicAssistTurn } from "./heuristic";
import type {
  AssistContext,
  AssistDomain,
  AssistDraft,
  AssistMessage,
  AssistQuestion,
  AssistSource,
  AssistTurnResult,
  CashDiscountDraft,
} from "./types";
import { ASSIST_DOMAINS } from "./types";

function aiCredentials(): { key: string; base: string; model: string } | null {
  const xai = process.env.XAI_API_KEY?.trim();
  if (xai) return { key: xai, base: "https://api.x.ai/v1", model: "grok-4.5" };
  const openai = process.env.OPENAI_API_KEY?.trim();
  if (openai) {
    return { key: openai, base: "https://api.openai.com/v1", model: "gpt-4o-mini" };
  }
  return null;
}

export function assistUsesAi(): boolean {
  return Boolean(aiCredentials());
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence?.[1]?.trim() ?? trimmed;
  const start = body.search(/[{[]/);
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
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
): Promise<string | null> {
  const creds = aiCredentials();
  if (!creds) return null;
  const res = await fetch(`${creds.base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${creds.key}`,
    },
    body: JSON.stringify({
      model: creds.model,
      temperature: 0.2,
      max_tokens: 700,
      messages,
    }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return body.choices?.[0]?.message?.content ?? "";
}

function systemPrompt(domain: AssistDomain, ctx: AssistContext): string {
  return `You are Summex setup assist (powered by Quantum Reach). Guest cards are Quantum Payments only.
Domain: ${domain}
Location: ${ctx.locationName || "this location"}
Cash discount: ${ctx.cashDiscountEnabled ? `${ctx.cashDiscountPercent}% round-up ${ctx.cashRoundIncrement}` : "off"}
Host multi-operator: ${ctx.hostMultiOperator ? "yes" : "no"}
Categories: ${ctx.categories.map((c) => c.name).join(", ") || "(none)"}
Operators: ${ctx.operators.map((o) => o.name).join(", ") || "(none)"}
Sections: ${ctx.sections.map((s) => s.name).join(", ") || "(none)"}

Return ONLY JSON:
{"type":"questions","questions":[{"id":"snake","prompt":"...","hint":"..."}]}
OR {"type":"draft","draft":{ "domain":"${domain}", ...fields }}

Rules:
- Max 5 follow-ups. Stop when you can draft. Never invent tax rates.
- Menu item: priceCents is the PRINTED/CARD amount (cents). If cash discount is on and the user stated one price, ask whether it is printed/card or cash. If cash, convert to printed (priceCents) using percent.
- Host multi-operator: if item operator is unclear, ask.
- Floor: expand "tables 1-6" into labels.
- Cash discount increment is 0.25 | 0.5 | 0.75 | 1.
- Staff role is owner|manager|server|bartender|host|kitchen|busser.
- Station is kitchen|bar|expo|dessert.
- Do not mention other processors.`;
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNum(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseDraft(raw: unknown, domain: AssistDomain): AssistDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const d = (o.domain as string) || domain;
  if (d === "menu_item") {
    const name = asString(o.name).trim();
    if (!name) return null;
    const station = asString(o.station, "kitchen");
    const course = asString(o.course, "entree");
    return {
      domain: "menu_item",
      name,
      description: asString(o.description),
      priceCents: Math.max(0, Math.round(asNum(o.priceCents))),
      priceBasis: o.priceBasis === "cash" ? "cash" : "card",
      categoryName: asString(o.categoryName, "Mains"),
      categoryId: asString(o.categoryId) || undefined,
      station:
        station === "bar" || station === "expo" || station === "dessert"
          ? station
          : "kitchen",
      vendorId: asString(o.vendorId) || undefined,
      vendorName: asString(o.vendorName) || undefined,
      modifierHint: asString(o.modifierHint) || undefined,
      course:
        course === "appetizer" ||
        course === "salad" ||
        course === "side" ||
        course === "dessert" ||
        course === "drink" ||
        course === "other"
          ? course
          : "entree",
    };
  }
  if (d === "category") {
    const name = asString(o.name).trim();
    if (!name) return null;
    const station = asString(o.station, "kitchen");
    return {
      domain: "category",
      name,
      station:
        station === "bar" || station === "expo" || station === "dessert"
          ? station
          : "kitchen",
    };
  }
  if (d === "modifier") {
    const name = asString(o.name).trim() || "Modifiers";
    const options = Array.isArray(o.options)
      ? o.options
          .map((x) => {
            const r = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
            return {
              name: asString(r.name).trim(),
              priceCents: Math.max(0, Math.round(asNum(r.priceCents))),
            };
          })
          .filter((x) => x.name)
      : [];
    return {
      domain: "modifier",
      name,
      required: Boolean(o.required),
      min: Math.max(0, Math.round(asNum(o.min, o.required ? 1 : 0))),
      max: Math.max(1, Math.round(asNum(o.max, 1))),
      options: options.length ? options : [{ name: "Standard", priceCents: 0 }],
    };
  }
  if (d === "floor") {
    const sections = Array.isArray(o.sections)
      ? o.sections.map((s) => {
          const r = s && typeof s === "object" ? (s as Record<string, unknown>) : {};
          const tables = Array.isArray(r.tables)
            ? r.tables.map((t) => {
                const tr = t && typeof t === "object" ? (t as Record<string, unknown>) : {};
                return {
                  label: asString(tr.label, "?"),
                  seats: Math.max(1, Math.round(asNum(tr.seats, 4))),
                };
              })
            : [];
          return { name: asString(r.name, "Dining"), tables };
        })
      : [];
    if (!sections.length) return null;
    return { domain: "floor", sections };
  }
  if (d === "operator") {
    const name = asString(o.name).trim();
    if (!name) return null;
    const st = asString(o.stationType, "kitchen");
    return {
      domain: "operator",
      name,
      shortName: asString(o.shortName, name.slice(0, 12)),
      stationType: st === "bar" || st === "both" ? st : "kitchen",
      payoutNote: asString(o.payoutNote) || undefined,
    };
  }
  if (d === "station") {
    const rules = Array.isArray(o.rules)
      ? o.rules.map((r) => {
          const row = r && typeof r === "object" ? (r as Record<string, unknown>) : {};
          const st = asString(row.station, "kitchen");
          const station: "kitchen" | "bar" | "expo" | "dessert" =
            st === "bar" || st === "expo" || st === "dessert" ? st : "kitchen";
          return {
            target: asString(row.target, "Menu"),
            station,
          };
        })
      : [];
    return { domain: "station", rules: rules.length ? rules : [] };
  }
  if (d === "staff") {
    const name = asString(o.name).trim();
    if (!name) return null;
    const role = asString(o.role, "server");
    const allowed = [
      "owner",
      "manager",
      "server",
      "bartender",
      "host",
      "kitchen",
      "busser",
    ] as const;
    return {
      domain: "staff",
      name,
      email: asString(o.email) || undefined,
      role: allowed.includes(role as (typeof allowed)[number])
        ? (role as (typeof allowed)[number])
        : "server",
    };
  }
  if (d === "location") {
    return {
      domain: "location",
      name: asString(o.name) || undefined,
      timezone: asString(o.timezone) || undefined,
      serviceStyle: asString(o.serviceStyle) || undefined,
    };
  }
  if (d === "cash_discount") {
    const inc = asNum(o.increment, 0.25);
    const increment: CashDiscountDraft["increment"] =
      inc === 1 || inc === 0.5 || inc === 0.75 || inc === 0.25 ? inc : 0.25;
    return {
      domain: "cash_discount",
      enabled: o.enabled !== false,
      percent: Math.max(0, asNum(o.percent, 5)),
      increment,
    };
  }
  return null;
}

function parseTurn(raw: unknown, domain: AssistDomain, source: AssistSource): AssistTurnResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.type === "questions" && Array.isArray(o.questions)) {
    const questions: AssistQuestion[] = [];
    o.questions.forEach((q, i) => {
      const row = q && typeof q === "object" ? (q as Record<string, unknown>) : {};
      const prompt = asString(row.prompt).trim();
      if (!prompt) return;
      const item: AssistQuestion = {
        id: asString(row.id).trim() || `q_${i}`,
        prompt,
      };
      if (asString(row.hint).trim()) item.hint = asString(row.hint).trim();
      questions.push(item);
    });
    questions.splice(5);
    if (questions.length) return { type: "questions", questions, source };
  }
  const draft = parseDraft(o.draft ?? o, domain);
  if (draft) return { type: "draft", draft, source };
  return null;
}

export async function runAssistSetupTurn(opts: {
  domain: AssistDomain;
  messages: AssistMessage[];
  context: AssistContext;
}): Promise<AssistTurnResult> {
  const domain = ASSIST_DOMAINS.includes(opts.domain) ? opts.domain : "menu_item";
  const messages = opts.messages.slice(-12);
  const fallback = heuristicAssistTurn(domain, messages, opts.context);

  if (!aiCredentials()) {
    console.info("[assist]", domain, "guided");
    return fallback;
  }

  try {
    const chat = [
      { role: "system" as const, content: systemPrompt(domain, opts.context) },
      ...messages.map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.text.slice(0, 2000),
      })),
    ];
    const text = await callModel(chat);
    const parsed = text ? parseTurn(extractJson(text), domain, "ai") : null;
    if (parsed) {
      console.info("[assist]", domain, "ai", parsed.type);
      return parsed;
    }
  } catch {
    /* guided fallback */
  }
  console.info("[assist]", domain, "guided-fallback");
  return fallback;
}
