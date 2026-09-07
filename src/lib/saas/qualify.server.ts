import { interviewUsesAi } from "./interview.server";
import {
  applyChip,
  applyUserText,
  openingTurn,
  type QualifyTurnResult,
} from "./qualify-engine";
import { quoteFromQualifySession } from "./qualify-quote";
import {
  emptyQualifySession,
  parseQualifySession,
  type QualifyChip,
  type QualifySession,
} from "./qualify-session";

export { interviewUsesAi as qualifyUsesAi } from "./interview.server";

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

async function polishAssistant(opts: {
  facts: unknown;
  entities: unknown;
  assistant: string;
  chips: QualifyChip[];
}): Promise<string | null> {
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
      temperature: 0.3,
      max_tokens: 220,
      messages: [
        {
          role: "system",
          content: `You are Summex Get a Price. Rewrite the assistant line so it confirms what we already know, then asks the next 1–2 gaps. Concise. No questionnaire dump. Never invent station counts, wells, kiosks, or tills — only use facts JSON. Guest cards are Quantum Payments. BYO tablets/printers/drawers. Return JSON {"text":"..."} only.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            facts: opts.facts,
            entities: opts.entities,
            draft: opts.assistant,
            chips: opts.chips.map((c) => c.label),
          }),
        },
      ],
    }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = extractJson(body.choices?.[0]?.message?.content ?? "");
  if (raw && typeof raw === "object" && typeof (raw as { text?: unknown }).text === "string") {
    const text = (raw as { text: string }).text.trim();
    return text || null;
  }
  return null;
}

function withQuote(turn: QualifyTurnResult): QualifyTurnResult {
  if (turn.readyToQuote && (turn.session.showQuote || turn.chips.some((c) => c.id === "price_now"))) {
    if (turn.session.showQuote) {
      const quote = quoteFromQualifySession(turn.session);
      turn.session.quote = quote;
      turn.session.assumptions = quote.assumptions;
    }
  }
  return turn;
}

export async function runQualifyTurn(opts: {
  message?: string;
  chip?: QualifyChip | null;
  session?: unknown;
  open?: boolean;
}): Promise<QualifyTurnResult & { ai: boolean }> {
  const parsed = parseQualifySession(opts.session) ?? emptyQualifySession();
  let turn: QualifyTurnResult;
  if (opts.open && parsed.messages.length === 0) {
    turn = openingTurn();
  } else if (opts.chip?.id) {
    turn = applyChip(parsed, opts.chip);
  } else {
    turn = applyUserText(parsed, String(opts.message ?? "").trim() || " ");
  }
  turn = withQuote(turn);
  const ai = interviewUsesAi();
  if (ai && turn.assistant) {
    try {
      const polished = await polishAssistant({
        facts: turn.session.facts,
        entities: turn.session.entities,
        assistant: turn.assistant,
        chips: turn.chips,
      });
      if (polished) {
        turn.assistant = polished;
        const last = turn.session.messages.filter((m) => m.role === "assistant").at(-1);
        if (last) last.text = polished;
      }
    } catch {
      /* keep heuristic copy */
    }
  }
  return { ...turn, ai };
}
