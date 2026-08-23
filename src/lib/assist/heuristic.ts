import type {
  AssistContext,
  AssistDraft,
  AssistDomain,
  AssistMessage,
  AssistQuestion,
  AssistTurnResult,
  CashDiscountDraft,
  CategoryDraft,
  FloorDraft,
  LocationDraft,
  MenuItemDraft,
  ModifierDraft,
  OperatorDraft,
  StaffDraft,
  StationDraft,
} from "./types";

const WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};

function blob(messages: AssistMessage[]): string {
  return messages
    .filter((m) => m.role === "user")
    .map((m) => m.text)
    .join("\n");
}

function reply(messages: AssistMessage[], id: string): string {
  const re = new RegExp(`(?:^|\\n)\\s*${id}\\s*[:\\-]\\s*(.+)`, "i");
  for (const m of messages.filter((x) => x.role === "user")) {
    const hit = m.text.match(re);
    if (hit?.[1]) return hit[1].trim();
  }
  return "";
}

function dollarsToCents(text: string): number | null {
  const money = text.match(/\$\s*(\d+(?:\.\d{1,2})?)/);
  if (money) return Math.round(parseFloat(money[1]!) * 100);
  const numDol = text.match(/(\d+(?:\.\d{1,2})?)\s*(?:dollars?|usd|bucks)\b/i);
  if (numDol) return Math.round(parseFloat(numDol[1]!) * 100);
  const words = text.toLowerCase().match(
    /\b((?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)(?:[\s-]+(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred))*)\s+dollars?\b/,
  );
  if (words) {
    let n = 0;
    for (const w of words[1]!.split(/[\s-]+/)) {
      const v = WORDS[w];
      if (v == null) continue;
      if (v === 100) n = (n || 1) * 100;
      else n += v;
    }
    if (n > 0) return n * 100;
  }
  return null;
}

function stationOf(text: string): MenuItemDraft["station"] {
  const t = text.toLowerCase();
  if (/\b(cocktail|wine|beer|spirit|bar|drink|beverage)\b/.test(t)) return "bar";
  if (/\bdessert|pastry|sweet\b/.test(t)) return "dessert";
  if (/\bexpo\b/.test(t)) return "expo";
  return "kitchen";
}

function courseOf(text: string): MenuItemDraft["course"] {
  const t = text.toLowerCase();
  if (/\b(app|starter|appetizer)\b/.test(t)) return "appetizer";
  if (/\bsalad\b/.test(t)) return "salad";
  if (/\bside\b/.test(t)) return "side";
  if (/\bdessert\b/.test(t)) return "dessert";
  if (/\b(drink|cocktail|wine|beer)\b/.test(t)) return "drink";
  if (/\bentree|main|steak|ribeye|pasta|burger|pizza\b/.test(t)) return "entree";
  return "other";
}

function firstClause(text: string): string {
  const part = text.split(/[,.\n]/)[0]?.trim() ?? "";
  return part.replace(/\s+/g, " ").slice(0, 80);
}

function emailOf(text: string): string | undefined {
  const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m?.[0];
}

function percentOf(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (m) return parseFloat(m[1]!);
  const w = text.toLowerCase().match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+percent\b/,
  );
  if (w) return WORDS[w[1]!] ?? null;
  return null;
}

function incrementOf(text: string): 0.25 | 0.5 | 0.75 | 1 {
  const t = text.toLowerCase();
  if (/dollar|\b1\.00\b|\b\$1\b/.test(t) && !/quarter|0\.25|0\.50|half/.test(t))
    return 1;
  if (/three[- ]quarters|0\.75|75\s*cents/.test(t)) return 0.75;
  if (/half[- ]dollar|0\.50|50\s*cents/.test(t)) return 0.5;
  return 0.25;
}

function rangeLabels(from: number, to: number): string[] {
  const out: string[] = [];
  const a = Math.min(from, to);
  const b = Math.max(from, to);
  for (let i = a; i <= b && out.length < 40; i++) out.push(String(i));
  return out;
}

function menuItem(text: string, ctx: AssistContext, messages: AssistMessage[]): AssistTurnResult {
  const price = dollarsToCents(text);
  const name = firstClause(text).replace(/\b(add|create|new item)\b/gi, "").trim() || "New item";
  const rest = text.includes(",") ? text.slice(text.indexOf(",") + 1).trim() : "";
  const desc = rest
    .replace(/\b(fifteen|sixteen|seventeen|eighteen|nineteen|twenty|\d+)\s+dollars?\b/gi, "")
    .replace(/\$\s*\d+(?:\.\d{1,2})?/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const station = stationOf(text);
  const catMatch = ctx.categories.find((c) =>
    text.toLowerCase().includes(c.name.toLowerCase()),
  );
  const vendorMatch = ctx.operators.find((o) =>
    text.toLowerCase().includes(o.name.toLowerCase()),
  );
  const basisAns = (reply(messages, "price_basis") || text).toLowerCase();
  const vendorAns = reply(messages, "operator");

  const questions: AssistQuestion[] = [];
  if (price == null) {
    questions.push({
      id: "price",
      prompt: "What is the price?",
      hint: "Printed/card menu price, e.g. $15",
    });
  } else if (ctx.cashDiscountEnabled && !/\b(card|printed|cash|menu price)\b/i.test(basisAns)) {
    questions.push({
      id: "price_basis",
      prompt: `Is ${price / 100 === Math.round(price / 100) ? `$${price / 100}` : `$${(price / 100).toFixed(2)}`} the printed/card menu price or the cash price?`,
      hint: "Printed/card stays on the menu. Cash is computed from it.",
    });
  }
  if (ctx.hostMultiOperator && !vendorMatch && !vendorAns) {
    questions.push({
      id: "operator",
      prompt: "Which operator owns this item?",
      hint: ctx.operators.map((o) => o.name).join(", ") || "Operator A / Operator B",
    });
  }
  if (!catMatch && ctx.categories.length > 1 && !reply(messages, "category")) {
    questions.push({
      id: "category",
      prompt: "Which category should this live in?",
      hint: ctx.categories.map((c) => c.name).join(", ") || "Mains, Starters, Bar",
    });
  }
  if (questions.length && questions.length <= 5) {
    return { type: "questions", questions: questions.slice(0, 5), source: "guided" };
  }

  const stated = dollarsToCents(reply(messages, "price") || text) ?? price ?? 0;
  const cashSaid = /\bcash\b/.test(basisAns) && !/\b(card|printed)\b/.test(basisAns);
  let priceCents = stated;
  if (cashSaid && ctx.cashDiscountEnabled && ctx.cashDiscountPercent > 0) {
    priceCents = Math.round(stated / (1 - ctx.cashDiscountPercent / 100));
  }
  const catName =
    reply(messages, "category") ||
    catMatch?.name ||
    ctx.categories.find((c) => c.station === station)?.name ||
    ctx.categories[0]?.name ||
    (station === "bar" ? "Bar" : "Mains");
  const opName = vendorAns || vendorMatch?.name;
  const op = ctx.operators.find(
    (o) => o.name.toLowerCase() === (opName ?? "").toLowerCase(),
  );

  const draft: MenuItemDraft = {
    domain: "menu_item",
    name: name.replace(/^\w/, (c) => c.toUpperCase()),
    description: desc,
    priceCents,
    priceBasis: cashSaid ? "cash" : "card",
    categoryName: catName,
    categoryId: catMatch?.id ?? ctx.categories.find((c) => c.name === catName)?.id,
    station,
    vendorId: op?.id,
    vendorName: op?.name ?? opName,
    course: courseOf(text),
  };
  return { type: "draft", draft, source: "guided" };
}

function category(text: string): AssistTurnResult {
  const name = firstClause(text).replace(/\b(category|section)\b/gi, "").trim() || "New category";
  const draft: CategoryDraft = {
    domain: "category",
    name: name.replace(/^\w/, (c) => c.toUpperCase()),
    station: stationOf(text),
  };
  return { type: "draft", draft, source: "guided" };
}

function modifier(text: string): AssistTurnResult {
  const name = firstClause(text) || "Modifiers";
  const opts = text
    .split(/[,;]| and /i)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && !/^add|modifier/i.test(s))
    .slice(0, 8)
    .map((n) => ({
      name: n.replace(/\$\s*\d+(?:\.\d{1,2})?/, "").trim(),
      priceCents: dollarsToCents(n) ?? 0,
    }))
    .filter((o) => o.name);
  const draft: ModifierDraft = {
    domain: "modifier",
    name: name.slice(0, 40),
    required: /\brequired|must\b/i.test(text),
    min: /\brequired|must\b/i.test(text) ? 1 : 0,
    max: Math.max(1, opts.length || 1),
    options: opts.length ? opts : [{ name: "Standard", priceCents: 0 }],
  };
  return { type: "draft", draft, source: "guided" };
}

function floor(text: string): AssistTurnResult {
  const sectionName =
    text.match(/section\s+([^,.\n]+)/i)?.[1]?.trim() ||
    text.match(/by the ([^,.\n]+)/i)?.[0]?.trim() ||
    "Dining";
  const range = text.match(/tables?\s+(\d+)\s*(?:-|–|to)\s*(\d+)/i);
  const seats = parseInt(text.match(/seats?\s+(\d+)/i)?.[1] ?? "4", 10) || 4;
  const labels = range
    ? rangeLabels(parseInt(range[1]!, 10), parseInt(range[2]!, 10))
    : ["1"];
  const draft: FloorDraft = {
    domain: "floor",
    sections: [
      {
        name: sectionName.replace(/^\w/, (c) => c.toUpperCase()),
        tables: labels.map((label) => ({ label, seats })),
      },
    ],
  };
  return { type: "draft", draft, source: "guided" };
}

function operator(text: string): AssistTurnResult {
  const name = firstClause(text).replace(/\b(operator|vendor|stall)\b/gi, "").trim() || "Operator";
  const t = text.toLowerCase();
  const stationType: OperatorDraft["stationType"] = /\bbar\b/.test(t) && /\bkitchen\b/.test(t)
    ? "both"
    : /\bbar\b/.test(t)
      ? "bar"
      : "kitchen";
  const draft: OperatorDraft = {
    domain: "operator",
    name: name.replace(/^\w/, (c) => c.toUpperCase()),
    shortName: name.slice(0, 12),
    stationType,
    payoutNote: text.match(/payout[:\s]+([^.\n]+)/i)?.[1]?.trim(),
  };
  return { type: "draft", draft, source: "guided" };
}

function station(text: string): AssistTurnResult {
  const st = stationOf(text);
  const target =
    firstClause(text).replace(/\b(route|send|station|kitchen|bar)\b/gi, "").trim() ||
    "Mains";
  const draft: StationDraft = {
    domain: "station",
    rules: [{ target: target || "All food", station: st }],
  };
  return { type: "draft", draft, source: "guided" };
}

function staff(text: string, messages: AssistMessage[]): AssistTurnResult {
  const email = emailOf(text);
  const roleHit = text.toLowerCase().match(
    /\b(owner|manager|server|bartender|host|kitchen|busser)\b/,
  );
  const questions: AssistQuestion[] = [];
  if (!email && !reply(messages, "email")) {
    questions.push({
      id: "email",
      prompt: "What email should we invite, if any?",
      hint: "Optional — leave blank for PIN-only staff",
    });
  }
  if (!roleHit && !reply(messages, "role")) {
    questions.push({
      id: "role",
      prompt: "What access level?",
      hint: "Owner, manager, server, bartender, host, kitchen, or busser",
    });
  }
  if (questions.length) {
    return { type: "questions", questions, source: "guided" };
  }
  const name =
    firstClause(text)
      .replace(email ?? "", "")
      .replace(/\b(add|invite|staff|server|manager)\b/gi, "")
      .trim() || "New staff";
  const roleRaw = (reply(messages, "role") || roleHit?.[1] || "server").toLowerCase();
  const role = (
    ["owner", "manager", "server", "bartender", "host", "kitchen", "busser"] as const
  ).includes(roleRaw as StaffDraft["role"])
    ? (roleRaw as StaffDraft["role"])
    : "server";
  const draft: StaffDraft = {
    domain: "staff",
    name: name.replace(/^\w/, (c) => c.toUpperCase()),
    email: email || reply(messages, "email") || undefined,
    role,
  };
  return { type: "draft", draft, source: "guided" };
}

function location(text: string): AssistTurnResult {
  const tz = text.match(/\b(America\/[A-Za-z_]+|US\/[A-Za-z]+)\b/)?.[1];
  const draft: LocationDraft = {
    domain: "location",
    name: firstClause(text).replace(/\b(location|called|named)\b/gi, "").trim() || undefined,
    timezone: tz,
    serviceStyle: /\bcounter|qsr\b/i.test(text)
      ? "counter"
      : /\btable|full.?service\b/i.test(text)
        ? "table"
        : undefined,
  };
  return { type: "draft", draft, source: "guided" };
}

function cashDiscount(text: string): AssistTurnResult {
  const off = /\b(off|disable|no cash discount)\b/i.test(text) && !/\benable|on\b/i.test(text);
  const percent = percentOf(text) ?? 5;
  const draft: CashDiscountDraft = {
    domain: "cash_discount",
    enabled: !off,
    percent,
    increment: incrementOf(text),
  };
  return { type: "draft", draft, source: "guided" };
}

export function heuristicAssistTurn(
  domain: AssistDomain,
  messages: AssistMessage[],
  ctx: AssistContext,
): AssistTurnResult {
  const text = blob(messages);
  switch (domain) {
    case "menu_item":
      return menuItem(text, ctx, messages);
    case "category":
      return category(text);
    case "modifier":
      return modifier(text);
    case "floor":
      return floor(text);
    case "operator":
      return operator(text);
    case "station":
      return station(text);
    case "staff":
      return staff(text, messages);
    case "location":
      return location(text);
    case "cash_discount":
      return cashDiscount(text);
    default:
      return {
        type: "questions",
        questions: [{ id: "more", prompt: "Tell us a bit more about what to set up." }],
        source: "guided",
      };
  }
}
