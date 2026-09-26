/**
 * Read a menu upload into a draft. This module never writes the catalog.
 */
import {
  buildMenuDraftFromLines,
  heuristicMenuLines,
  linesFromModelJson,
  MENU_AI_MISSING,
  MENU_EMPTY_EXTRACT,
  MENU_FILE_MAX_BYTES,
  menuAnalyzeSource,
  pickIntakeLines,
  type IntakeSettings,
  type MenuIntakeDraft,
} from "./intake.ts";
import { extractMenuText, pdfEmbeddedJpegs } from "./intake-file.ts";

const MAX_BYTES = MENU_FILE_MAX_BYTES;

export function menuAiCredentials(): { key: string; base: string; model: string } | null {
  const xai = process.env.XAI_API_KEY?.trim();
  if (xai) return { key: xai, base: "https://api.x.ai/v1", model: "grok-4.5" };
  const openai = process.env.OPENAI_API_KEY?.trim();
  if (openai) return { key: openai, base: "https://api.openai.com/v1", model: "gpt-4o" };
  return null;
}

const MENU_SYSTEM = `You extract sellable menu items for this one selling entity. Ignore every other brand on the page. Return JSON only.
{"items":[{"group":"","name":"","description":"","price":"14.00","priceKind":"cash"|"card"|"unknown","modifiers":[],"alcohol":true|false|null,"abv":"","size":"","eightySix":""}]}
group is the category. price is dollars when printed. priceKind is unknown when the line shows only one price. modifiers are extras printed on that item. abv and size when a drink prints them. eightySix when the page says 86 or sold out. Omit tax. 80 items max.`;

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

function decodeBase64(b64: string): Uint8Array {
  const buf = Buffer.from(b64, "base64");
  const bytes = new Uint8Array(buf.byteLength);
  bytes.set(buf);
  return bytes;
}

function mimeFor(fileName: string): string {
  const name = fileName.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".heic") || name.endsWith(".heif")) return "image/heic";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "image/jpeg";
}

function dataUrl(mime: string, bytes: Uint8Array): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

function providerMessage(status: number, json: unknown): string {
  const body = json && typeof json === "object" ? (json as { error?: { message?: string } | string }) : {};
  const err = body.error;
  if (typeof err === "string" && err.trim()) return err.trim().slice(0, 300);
  if (err && typeof err === "object" && typeof err.message === "string" && err.message.trim()) {
    return err.message.trim().slice(0, 300);
  }
  return `Menu reading failed (${status})`;
}

async function readWithModel(opts: {
  entityId: string;
  text: string;
  images: string[];
  locationId?: string;
  aiFetch?: typeof fetch;
}): Promise<unknown> {
  const creds = menuAiCredentials();
  if (!creds) throw new Error(MENU_AI_MISSING);
  if (!opts.aiFetch) {
    const { reserveAiCall } = await import("@/lib/comms/ai.server");
    const gate = await reserveAiCall({ locationId: opts.locationId, kind: "menu_intake" });
    if (!gate.allow) {
      throw new Error(gate.reason === "daily_cap" ? "AI daily limit reached" : MENU_AI_MISSING);
    }
  }
  const userContent: unknown[] = [
    {
      type: "text",
      text: `Entity id: ${opts.entityId || "house"}. Extract sellable items for this entity only.\n${opts.text.slice(0, 12000)}`,
    },
  ];
  for (const url of opts.images.slice(0, 4)) {
    userContent.push({ type: "image_url", image_url: { url: url.slice(0, 8_000_000) } });
  }
  const res = await (opts.aiFetch ?? fetch)(`${creds.base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${creds.key}`,
    },
    body: JSON.stringify({
      model: creds.model,
      temperature: 0.1,
      max_tokens: 4000,
      messages: [
        { role: "system", content: MENU_SYSTEM },
        { role: "user", content: userContent },
      ],
    }),
  });
  const json = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) throw new Error(providerMessage(res.status, json));
  const content =
    (json as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? "";
  return extractJson(content) ?? { items: [] };
}

export async function extractMenuIntake(opts: {
  entityId: string;
  text?: string;
  fileName?: string;
  fileBase64?: string;
  /** Set only after the file row is loaded. A client blob is not enough. */
  storedFileId?: string;
  locationId?: string;
  settings: IntakeSettings;
  /** Test double. Production uses fetch. */
  aiFetch?: typeof fetch;
}): Promise<MenuIntakeDraft> {
  const source = menuAnalyzeSource({ text: opts.text, fileId: opts.storedFileId });
  if (source.kind === "refuse") throw new Error(source.error);
  const entityId = opts.entityId.trim().slice(0, 80);
  let bytes: Uint8Array | undefined;
  if (source.kind === "file") {
    if (!opts.fileBase64) throw new Error("Upload a menu first");
    bytes = decodeBase64(opts.fileBase64);
    if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) throw new Error("Upload a menu first");
  }
  const fileName = opts.fileName ?? "";
  const extracted = extractMenuText({
    fileName,
    bytes,
    pasted: opts.text,
  });
  const images: string[] = [];
  if (extracted.image && bytes) {
    images.push(dataUrl(mimeFor(fileName), bytes));
  } else if (bytes && (fileName.toLowerCase().endsWith(".pdf") || (bytes[0] === 0x25 && bytes[1] === 0x50))) {
    const thin = extracted.text.trim().length < 40;
    if (thin) {
      for (const jpeg of pdfEmbeddedJpegs(bytes)) images.push(dataUrl("image/jpeg", jpeg));
    }
  }
  const textLines = heuristicMenuLines(extracted.text);
  const parsed = await readWithModel({
    entityId,
    text: extracted.text,
    images,
    locationId: opts.locationId,
    aiFetch: opts.aiFetch,
  });
  const aiLines = linesFromModelJson(parsed);
  const picked = pickIntakeLines(textLines, aiLines);
  const lines = picked.lines;
  const note = lines.length === 0 ? MENU_EMPTY_EXTRACT : undefined;
  return buildMenuDraftFromLines({
    lines,
    entityId,
    settings: opts.settings,
    source: aiLines && aiLines.length ? "ai" : picked.source,
    note,
  });
}
