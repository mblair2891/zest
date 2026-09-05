import { getSql } from "@/lib/db";
import {
  applyRecommendation,
  followUpRoundCount,
  heuristicInterviewTurn,
  interviewSystemPrompt,
  parseRecommendation,
} from "./interview";
import type {
  InterviewMessage,
  InterviewQuestion,
  InterviewRecommendation,
  InterviewSource,
  InterviewStatus,
  InterviewTurnResult,
} from "./prospect-types";
import {
  assertCanAccessProspect,
  getProspectByToken,
} from "./prospects.server";
import { writeAudit } from "./tenancy.server";

function aiCredentials(): { key: string; base: string; model: string } | null {
  const xai = process.env.XAI_API_KEY?.trim();
  if (xai) {
    return { key: xai, base: "https://api.x.ai/v1", model: "grok-4.5" };
  }
  const openai = process.env.OPENAI_API_KEY?.trim();
  if (openai) {
    return { key: openai, base: "https://api.openai.com/v1", model: "gpt-4o-mini" };
  }
  return null;
}

export function interviewUsesAi(): boolean {
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

async function callModel(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) {
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
      temperature: 0.3,
      max_tokens: 900,
      messages,
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`AI provider error ${res.status}${errText ? `: ${errText.slice(0, 180)}` : ""}`);
  }
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return body.choices?.[0]?.message?.content ?? "";
}

function parseTurn(raw: unknown, source: InterviewSource): InterviewTurnResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.type === "questions" && Array.isArray(o.questions)) {
    const questions: InterviewQuestion[] = [];
    o.questions.forEach((q, i) => {
      const row = q && typeof q === "object" ? (q as Record<string, unknown>) : {};
      const prompt = typeof row.prompt === "string" ? row.prompt.trim() : "";
      if (!prompt) return;
      const item: InterviewQuestion = {
        id: typeof row.id === "string" && row.id.trim() ? row.id.trim() : `q_${i}`,
        prompt,
      };
      if (typeof row.hint === "string" && row.hint.trim()) item.hint = row.hint.trim();
      questions.push(item);
    });
    questions.splice(5);
    if (questions.length) {
      const draft = parseRecommendation(o.draftRecommendation ?? o.draft ?? null);
      return {
        type: "questions",
        questions,
        source,
        ...(draft ? { draftRecommendation: draft } : {}),
      };
    }
  }
  if (o.type === "recommendation" || o.recommendation) {
    const rec = parseRecommendation(o.recommendation ?? o);
    if (rec) return { type: "recommendation", recommendation: rec, source };
  }
  const rec = parseRecommendation(o);
  if (rec) return { type: "recommendation", recommendation: rec, source };
  return null;
}

export async function runInterviewTurn(opts: {
  userId: string | null;
  token: string;
  freeText: string;
  replies?: Array<{ id: string; answer: string }>;
}): Promise<{
  prospectToken: string;
  messages: InterviewMessage[];
  turn: InterviewTurnResult;
  interviewStatus: InterviewStatus;
}> {
  const token = opts.token.trim();
  const prospect = await getProspectByToken(token);
  if (!prospect) throw new Error("Prospect not found");
  await assertCanAccessProspect({ userId: opts.userId, prospect, token, write: true });

  const freeText = opts.freeText.replace(/^Contact email:[^\n]*\n/i, "").trim();
  if (freeText.length < 40) {
    throw new Error("Describe the operation in at least a couple of sentences (~40 characters).");
  }

  const prior = prospect.interviewMessages;
  const now = new Date().toISOString();
  const messages: InterviewMessage[] = [...prior];
  const storedNarrative = (prospect.interviewFreeText || "").trim();
  const newFacts =
    storedNarrative.length > 0 &&
    freeText.length > storedNarrative.length + 24 &&
    freeText !== storedNarrative;
  if (!messages.length || messages[0]?.text !== freeText) {
    if (!messages.some((m) => m.role === "user" && m.text === freeText)) {
      messages.push({ role: "user", text: freeText, at: now });
    }
  }
  if (opts.replies?.length) {
    const blob = opts.replies
      .map((r) => `${r.id}: ${r.answer.trim()}`)
      .filter((s) => s.length > 3)
      .join("\n");
    if (blob) messages.push({ role: "user", text: blob, at: now });
  }

  const rounds = followUpRoundCount(messages);
  const forceRecommend = rounds >= 2 && Boolean(opts.replies?.length) && !newFacts;
  let turn: InterviewTurnResult | null = null;
  let source: InterviewSource = "heuristic";

  const intakeSnapshot = {
    company: prospect.answers.company,
    portfolio: prospect.answers.portfolio,
    operating: prospect.answers.operating,
    modules: prospect.answers.modules,
    volume: prospect.answers.volume,
    hardware: prospect.answers.hardware,
  };

  try {
    const content = await callModel([
      { role: "system", content: interviewSystemPrompt() },
      {
        role: "user",
        content: JSON.stringify({
          freeText,
          intakeAlreadyFilled: intakeSnapshot,
          priorMessages: messages.map((m) => ({ role: m.role, text: m.text })),
          followUpRound: rounds,
          newFactsAdded: newFacts,
          instruction: forceRecommend
            ? "Two follow-up rounds are done. Return a recommendation now. Do not ask more questions."
            : "Ask 2–5 questions only about what is missing or ambiguous in THEIR description. Do not use a generic list. Include draftRecommendation.",
        }),
      },
    ]);
    if (content) {
      source = "ai";
      turn = parseTurn(extractJson(content), "ai");
    }
  } catch {
    turn = null;
    source = "heuristic";
  }

  if (forceRecommend && turn?.type === "questions") {
    turn = null;
  }

  if (!turn) {
    turn = heuristicInterviewTurn({ freeText, messages, forceRecommend });
    source = "heuristic";
  }
  if (forceRecommend && turn.type === "questions") {
    turn = heuristicInterviewTurn({ freeText, messages, forceRecommend: true });
  }

  if (turn.type === "questions") {
    const labeled = turn.questions
      .map((q) => `[q:${q.id}] ${q.prompt}`)
      .join("\n");
    messages.push({ role: "assistant", text: labeled, at: new Date().toISOString() });
  } else {
    messages.push({
      role: "assistant",
      text: `Recommendation: ${turn.recommendation.summary}`,
      at: new Date().toISOString(),
    });
  }

  const recForStore =
    turn.type === "recommendation"
      ? turn.recommendation
      : turn.draftRecommendation ?? prospect.interviewRecommendation;
  const recJson = recForStore ? JSON.stringify(recForStore) : null;
  const sql = await getSql();
  await sql`
    update prospects
    set interview_free_text = ${freeText},
        interview_messages = ${JSON.stringify(messages)}::jsonb,
        interview_recommendation = ${recJson}::jsonb,
        interview_source = ${source},
        interview_status = 'in_progress',
        updated_at = now()
    where id = ${prospect.id}
  `;
  await writeAudit({
    actorUserId: opts.userId,
    action: "interview_turn",
    payload: { prospectId: prospect.id, type: turn.type, source },
  });

  return {
    prospectToken: prospect.publicToken,
    messages,
    turn: { ...turn, source },
    interviewStatus: "in_progress",
  };
}

export async function finishInterview(opts: {
  userId: string | null;
  token: string;
  status: "accepted" | "skipped";
  recommendation?: unknown;
  email?: string;
}): Promise<{
  answers: import("./prospect-types").IntakeAnswers;
  interviewStatus: InterviewStatus;
  recommendation: InterviewRecommendation | null;
}> {
  const prospect = await getProspectByToken(opts.token.trim());
  if (!prospect) throw new Error("Prospect not found");
  await assertCanAccessProspect({
    userId: opts.userId,
    prospect,
    token: opts.token,
    write: true,
  });
  const rec =
    parseRecommendation(opts.recommendation) ?? prospect.interviewRecommendation;
  let answers = prospect.answers;
  if (opts.status === "accepted") {
    if (!rec) throw new Error("No recommendation to accept");
    answers = applyRecommendation(prospect.answers, rec);
  }
  const email = opts.email?.trim().toLowerCase();
  if (email && email.includes("@")) {
    answers = {
      ...answers,
      company: { ...answers.company, billingEmail: email },
    };
  }
  const sql = await getSql();
  await sql`
    update prospects
    set interview_status = ${opts.status},
        interview_recommendation = ${rec ? JSON.stringify(rec) : null}::jsonb,
        answers = ${JSON.stringify(answers)}::jsonb,
        email = coalesce(${email && email.includes("@") ? email : null}, email),
        updated_at = now()
    where id = ${prospect.id}
  `;
  await writeAudit({
    actorUserId: opts.userId,
    action: opts.status === "accepted" ? "interview_accepted" : "interview_skipped",
    payload: { prospectId: prospect.id },
  });
  return { answers, interviewStatus: opts.status, recommendation: rec };
}


