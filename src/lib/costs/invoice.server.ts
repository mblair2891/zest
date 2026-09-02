import { heuristicInvoiceExtract } from "./invoice-parse";
import type { InvoiceExtract } from "./types";

function aiCredentials(): { key: string; base: string; model: string } | null {
  const xai = process.env.XAI_API_KEY?.trim();
  if (xai) return { key: xai, base: "https://api.x.ai/v1", model: "grok-4.5" };
  const openai = process.env.OPENAI_API_KEY?.trim();
  if (openai) {
    return { key: openai, base: "https://api.openai.com/v1", model: "gpt-4o-mini" };
  }
  return null;
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
  }
  return null;
}

function asExtract(raw: unknown, fallback: InvoiceExtract): InvoiceExtract {
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;
  const linesRaw = Array.isArray(o.lines) ? o.lines : [];
  const lines = linesRaw
    .map((x) => {
      const r = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
      const name = String(r.name ?? r.description ?? "").trim();
      if (!name) return null;
      const qty = (Number(r.qty ?? r.quantity ?? 1) || 1);
      let unitCostCents = Math.round(Number(r.unitCostCents ?? 0));
      if (!unitCostCents && r.unitCost != null) {
        unitCostCents = Math.round(Number(r.unitCost) * 100);
      }
      if (!unitCostCents && r.unit_price != null) {
        unitCostCents = Math.round(Number(r.unit_price) * 100);
      }
      return {
        name,
        qty,
        unitCostCents: Math.max(0, unitCostCents),
        packSize: r.packSize ? String(r.packSize) : undefined,
      };
    })
    .filter((v): v is NonNullable<typeof v> => Boolean(v))
    .slice(0, 60);
  return {
    vendorName: String(o.vendorName ?? o.vendor ?? fallback.vendorName).slice(0, 80),
    invoiceNumber: String(o.invoiceNumber ?? o.number ?? fallback.invoiceNumber).slice(0, 40),
    dateIso: String(o.dateIso ?? o.date ?? fallback.dateIso).slice(0, 10),
    lines: lines.length ? lines : fallback.lines,
    note: o.note ? String(o.note) : undefined,
    source: "ai",
  };
}

export async function parseInvoiceExtract(opts: {
  text: string;
  fileName?: string;
  imageDataUrl?: string;
  locationId?: string;
}): Promise<InvoiceExtract> {
  const fallback = heuristicInvoiceExtract(opts.text, opts.fileName);
  const creds = aiCredentials();
  if (!creds) return fallback;
  try {
    const { reserveAiCall } = await import("@/lib/comms/ai.server");
    const gate = await reserveAiCall({ locationId: opts.locationId, kind: "invoice" });
    if (!gate.allow) return fallback;
  } catch {
    /* heuristic extract */
  }

  const userContent: unknown[] = [
    {
      type: "text",
      text: `Extract a hospitality supplier invoice as JSON:
{"vendorName":"","invoiceNumber":"","dateIso":"YYYY-MM-DD","lines":[{"name":"","qty":1,"unitCostCents":0,"packSize":""}]}
unitCostCents is integer cents. Guest cards are Quantum Payments — this is a supplier bill, not a guest check.
Text/filename:\n${(opts.text || opts.fileName || "").slice(0, 4000)}`,
    },
  ];
  if (opts.imageDataUrl?.startsWith("data:image")) {
    userContent.push({
      type: "image_url",
      image_url: { url: opts.imageDataUrl.slice(0, 1_500_000) },
    });
  }

  try {
    const res = await fetch(`${creds.base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creds.key}`,
      },
      body: JSON.stringify({
        model: creds.model,
        temperature: 0.1,
        max_tokens: 1200,
        messages: [
          {
            role: "system",
            content:
              "You extract supplier invoices for Summex cost control. Return JSON only. Never invent SKUs that are not on the document. If the image is unreadable, return empty lines.",
          },
          { role: "user", content: userContent },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const parsed = extractJson(body.choices?.[0]?.message?.content ?? "");
    if (!parsed) return fallback;
    return asExtract(parsed, fallback);
  } catch {
    return fallback;
  }
}

export async function narrativeCostPicture(prompt: string, locationId?: string): Promise<string | null> {
  const creds = aiCredentials();
  if (!creds) return null;
  try {
    const { reserveAiCall } = await import("@/lib/comms/ai.server");
    const gate = await reserveAiCall({ locationId, kind: "cost_picture" });
    if (!gate.allow) return null;
  } catch {
    return null;
  }
  try {
    const res = await fetch(`${creds.base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creds.key}`,
      },
      body: JSON.stringify({
        model: creds.model,
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          {
            role: "system",
            content:
              "You write a short cost-control brief for Summex (powered by Quantum Reach). Do not accuse staff of theft. Flag variance as investigation items. Return plain text, 3–6 sentences.",
          },
          { role: "user", content: prompt.slice(0, 4000) },
        ],
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return body.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

export function costAiEnabled(): boolean {
  return Boolean(aiCredentials());
}
