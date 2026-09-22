/**
 * Read a menu upload into a draft. This module never writes the catalog.
 */
import {
  buildMenuDraftFromLines,
  heuristicMenuLines,
  linesFromModelJson,
  pickIntakeLines,
  type IntakeSettings,
  type MenuIntakeDraft,
} from "./intake";
import { extractMenuText } from "./intake-file";

const MAX_BYTES = 1_500_000;

function aiCredentials(): { key: string; base: string; model: string } | null {
  const xai = process.env.XAI_API_KEY?.trim();
  if (xai) return { key: xai, base: "https://api.x.ai/v1", model: "grok-4.5" };
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
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "image/jpeg";
}

async function readWithModel(opts: {
  text: string;
  imageDataUrl?: string;
  locationId?: string;
}): Promise<unknown | null> {
  const creds = aiCredentials();
  if (!creds) return null;
  if (!opts.text.trim() && !opts.imageDataUrl) return null;
  try {
    const { reserveAiCall } = await import("@/lib/comms/ai.server");
    const gate = await reserveAiCall({ locationId: opts.locationId, kind: "menu_intake" });
    if (!gate.allow) return null;
  } catch {
    return null;
  }
  const userContent: unknown[] = [
    {
      type: "text",
      text: `Extract this restaurant menu as JSON:
{"items":[{"group":"","name":"","description":"","price":"14.00","priceKind":"cash"|"card"|"unknown","modifiers":[],"alcohol":true|false|null}]}
price is dollars. priceKind cash when the page labels cash. priceKind card when the page labels card. priceKind unknown when the line shows one unlabeled price.
modifiers are extras or add-ons printed on that item. alcohol true for beer, wine, and cocktails; false for food and non-alcoholic drinks; null when unclear.
Tax stays on the venue tax screen — omit tax. Include only items printed on this menu. 80 items max.
Menu text:
${opts.text.slice(0, 8000)}`,
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
        max_tokens: 1600,
        messages: [
          {
            role: "system",
            content:
              "You extract a menu for one selling entity in Summex. Return JSON only. Cash is the till price. Omit tax. Skip items that are not on the page.",
          },
          { role: "user", content: userContent },
        ],
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return extractJson(body.choices?.[0]?.message?.content ?? "");
  } catch {
    return null;
  }
}

export async function extractMenuIntake(opts: {
  entityId: string;
  text?: string;
  fileName?: string;
  fileBase64?: string;
  locationId?: string;
  settings: IntakeSettings;
}): Promise<MenuIntakeDraft> {
  const entityId = opts.entityId.trim().slice(0, 80);
  let bytes: Uint8Array | undefined;
  if (opts.fileBase64 && opts.fileBase64.length <= 2_100_000) {
    bytes = decodeBase64(opts.fileBase64);
    if (bytes.byteLength > MAX_BYTES) bytes = undefined;
  }
  const extracted = extractMenuText({
    fileName: opts.fileName,
    bytes,
    pasted: opts.text,
  });
  const textLines = heuristicMenuLines(extracted.text);
  const imageUrl =
    extracted.image && opts.fileBase64
      ? `data:${mimeFor(opts.fileName ?? "menu.jpg")};base64,${opts.fileBase64}`
      : undefined;
  const parsed = await readWithModel({
    text: extracted.text,
    imageDataUrl: imageUrl,
    locationId: opts.locationId,
  });
  const picked = pickIntakeLines(textLines, linesFromModelJson(parsed));
  let note: string | undefined;
  if (picked.lines.length === 0 && extracted.image && !extracted.text.trim()) {
    note = "Paste the menu text on this screen. A photo is read when AI is available for this location.";
  } else if (picked.lines.length === 0 && (opts.fileName || "").toLowerCase().endsWith(".pdf")) {
    note = "This PDF has no selectable text. Paste the menu, or upload a photo of the page.";
  }
  return buildMenuDraftFromLines({
    lines: picked.lines,
    entityId,
    settings: opts.settings,
    source: picked.source,
    note,
  });
}
