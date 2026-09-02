import { applyMenuTemplate } from "./category-templates";
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
  MenuItemDraft,
  SuggestedModifierGroup,
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
      max_tokens: 1100,
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
  const seed = ctx.seedItem
    ? `Editing existing item "${ctx.seedItem.name}" id=${ctx.seedItem.id} (keep identity; fill missing; refine modifiers).`
    : "Creating a new item.";
  const scoped = ctx.scopedVendorId
    ? `Locked operator: ${ctx.scopedVendorName || ctx.scopedVendorId} — do not change entity.`
    : "";
  const mods = (ctx.existingModifiers ?? [])
    .slice(0, 12)
    .map((m) => m.name)
    .join(", ");
  return `You are Summex setup assist (powered by Quantum Reach). Guest cards are Quantum Payments only.
Domain: ${domain}
Location: ${ctx.locationName || "this location"}
Cash discount: ${ctx.cashDiscountEnabled ? `${ctx.cashDiscountPercent}% round-up ${ctx.cashRoundIncrement}` : "off"}
Host multi-operator: ${ctx.hostMultiOperator ? "yes" : "no"}
${seed}
${scoped}
Categories: ${ctx.categories.map((c) => c.name).join(", ") || "(none)"}
Operators: ${ctx.operators.map((o) => o.name).join(", ") || "(none)"}
Existing modifier groups: ${mods || "(none)"}
Sections: ${ctx.sections.map((s) => s.name).join(", ") || "(none)"}

Return ONLY JSON:
{"type":"questions","questions":[{"id":"snake","prompt":"...","hint":"..."}]}
OR {"type":"draft","draft":{ "domain":"${domain}", ...fields }}

Rules:
- Max 3 follow-ups. Ask only when needed (missing price; cash vs card if cash discount is on and the price basis is unclear; operator on a host floor when not locked). Stop as soon as you can draft.
- Never invent tax rates. Do not mention other processors.
- Menu item draft fields: name, description, priceCents (PRINTED/CARD cents), priceBasis ("card"|"cash"), categoryName, station (kitchen|bar|expo|dessert), course (appetizer|salad|entree|side|dessert|drink|other), vendorId, vendorName, modifierGroups[{name,required,min,max,options[{name,priceCents}]}], omitPresets[string], addPresets[{name,priceCents}].
- Suggest 1–3 modifier groups (temp, size, protein, dressing) plus common omit/add presets from the description. Omits are $0. Add-ons may have modest prices in cents.
- Prefer existing modifier group names when they fit.
- If cash discount is on and the user stated one price as cash, convert to printed priceCents.
- Floor: expand "tables 1-6" into labels.
- Cash discount increment is 0.25 | 0.5 | 0.75 | 1.
- Staff role is owner|manager|server|bartender|host|kitchen|busser.`;
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNum(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseModifierGroups(raw: unknown): SuggestedModifierGroup[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      const r = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
      const name = asString(r.name).trim();
      if (!name) return null;
      const options = Array.isArray(r.options)
        ? r.options
            .map((opt) => {
              const o = opt && typeof opt === "object" ? (opt as Record<string, unknown>) : {};
              const n = asString(o.name).trim();
              if (!n) return null;
              return { name: n, priceCents: Math.max(0, Math.round(asNum(o.priceCents))) };
            })
            .filter((v): v is { name: string; priceCents: number } => Boolean(v))
        : [];
      if (!options.length) return null;
      const required = Boolean(r.required);
      return {
        name,
        required,
        min: Math.max(0, Math.round(asNum(r.min, required ? 1 : 0))),
        max: Math.max(1, Math.round(asNum(r.max, Math.max(1, options.length)))),
        options,
      } satisfies SuggestedModifierGroup;
    })
    .filter((g): g is SuggestedModifierGroup => Boolean(g))
    .slice(0, 6);
}

function parseDraft(raw: unknown, domain: AssistDomain, ctx?: AssistContext): AssistDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const d = (o.domain as string) || domain;
  if (d === "menu_item") {
    const name = asString(o.name).trim() || asString(ctx?.seedItem?.name).trim();
    if (!name) return null;
    const station = asString(o.station, ctx?.seedItem?.station || "kitchen");
    const course = asString(o.course, ctx?.seedItem?.course || "entree");
    const omitPresets = Array.isArray(o.omitPresets)
      ? o.omitPresets.map((x) => asString(x).trim()).filter(Boolean).slice(0, 10)
      : [];
    const addPresets = Array.isArray(o.addPresets)
      ? o.addPresets
          .map((x) => {
            if (typeof x === "string") {
              const n = x.trim();
              return n ? { name: n, priceCents: 0 } : null;
            }
            const r = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
            const n = asString(r.name).trim();
            if (!n) return null;
            return { name: n, priceCents: Math.max(0, Math.round(asNum(r.priceCents))) };
          })
          .filter((v): v is { name: string; priceCents: number } => Boolean(v))
          .slice(0, 10)
      : [];
    const vendorId =
      ctx?.scopedVendorId || asString(o.vendorId) || ctx?.seedItem?.vendorId || undefined;
    const st: "kitchen" | "bar" | "expo" | "dessert" =
      station === "bar" || station === "expo" || station === "dessert" ? station : "kitchen";
    const draft = {
      domain: "menu_item" as const,
      name,
      description: asString(o.description) || asString(ctx?.seedItem?.description),
      priceCents: Math.max(
        0,
        Math.round(asNum(o.priceCents, ctx?.seedItem?.priceCents ?? 0)),
      ),
      priceBasis: o.priceBasis === "cash" ? ("cash" as const) : ("card" as const),
      categoryName: asString(o.categoryName, "Mains"),
      categoryId: asString(o.categoryId) || ctx?.seedItem?.categoryId || undefined,
      station: st,
      vendorId,
      vendorName: ctx?.scopedVendorName || asString(o.vendorName) || undefined,
      modifierHint: asString(o.modifierHint) || undefined,
      course: (["appetizer", "salad", "side", "dessert", "drink", "other"].includes(course)
        ? course
        : "entree") as MenuItemDraft["course"],
      itemId: asString(o.itemId) || ctx?.seedItem?.id,
      modifierGroups: parseModifierGroups(o.modifierGroups),
      omitPresets,
      addPresets,
    };
    return applyMenuTemplate(draft, `${name} ${draft.description}`);
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

function parseTurn(
  raw: unknown,
  domain: AssistDomain,
  source: AssistSource,
  ctx?: AssistContext,
): AssistTurnResult | null {
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
    questions.splice(3);
    if (questions.length) return { type: "questions", questions, source };
  }
  const draft = parseDraft(o.draft ?? o, domain, ctx);
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
    const { reserveAiCall } = await import("@/lib/comms/ai.server");
    const gate = await reserveAiCall({
      locationId: opts.context.locationId,
      kind: `assist:${domain}`,
    });
    if (!gate.allow) {
      console.info("[assist]", domain, "throttled", gate.reason);
      return fallback;
    }
  } catch {
    /* guided fallback if throttle store is unavailable */
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
    const parsed = text ? parseTurn(extractJson(text), domain, "ai", opts.context) : null;
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
