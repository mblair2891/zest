/**
 * Pull plain text out of a menu upload. PDF and DOCX stay on the server.
 * Photos return no text — the caller sends the image to the model.
 */
import { inflateRawSync } from "node:zlib";

export function extractMenuText(opts: {
  fileName?: string;
  bytes?: Uint8Array;
  pasted?: string;
}): { text: string; image: boolean } {
  const name = (opts.fileName ?? "").toLowerCase();
  const pasted = opts.pasted?.trim() ?? "";
  if (!opts.bytes?.length) return { text: pasted, image: false };
  if (
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".webp") ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  ) {
    return { text: pasted, image: true };
  }
  if (name.endsWith(".docx")) {
    return { text: [docxToText(opts.bytes), pasted].filter(Boolean).join("\n"), image: false };
  }
  if (name.endsWith(".pdf") || looksPdf(opts.bytes)) {
    return { text: [pdfToText(opts.bytes), pasted].filter(Boolean).join("\n"), image: false };
  }
  const asText = new TextDecoder().decode(opts.bytes);
  return { text: [asText, pasted].filter(Boolean).join("\n"), image: false };
}

/** JPEG streams embedded in a scan. Used when the PDF has almost no text. */
export function pdfEmbeddedJpegs(bytes: Uint8Array, limit = 4): Uint8Array[] {
  const out: Uint8Array[] = [];
  let i = 0;
  while (i < bytes.length - 3 && out.length < limit) {
    if (bytes[i] !== 0xff || bytes[i + 1] !== 0xd8 || bytes[i + 2] !== 0xff) {
      i += 1;
      continue;
    }
    let j = i + 3;
    let end = -1;
    while (j < bytes.length - 1) {
      if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
        end = j + 2;
        break;
      }
      j += 1;
    }
    if (end < 0) break;
    const slice = bytes.slice(i, end);
    if (slice.byteLength > 4000) out.push(slice);
    i = end;
  }
  return out;
}

function looksPdf(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

/** Parenthesized PDF strings, which is where a text menu usually lives. */
export function pdfToText(bytes: Uint8Array): string {
  const raw = new TextDecoder("latin1").decode(bytes);
  const parts: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== "(" || (i > 0 && raw[i - 1] === "\\")) continue;
    let depth = 1;
    let inner = "";
    let j = i + 1;
    while (j < raw.length && depth > 0) {
      const ch = raw[j]!;
      if (ch === "\\" && j + 1 < raw.length) {
        const n = raw[j + 1]!;
        inner += n === "n" ? "\n" : n;
        j += 2;
        continue;
      }
      if (ch === "(") {
        depth += 1;
        inner += ch;
        j += 1;
        continue;
      }
      if (ch === ")") {
        depth -= 1;
        if (depth === 0) break;
        inner += ch;
        j += 1;
        continue;
      }
      inner += ch;
      j += 1;
    }
    if (depth === 0 && /[A-Za-z]/.test(inner)) parts.push(inner);
    i = j;
  }
  return parts.join("\n");
}

export function docxToText(bytes: Uint8Array): string {
  const xml = unzipEntry(bytes, "word/document.xml");
  if (!xml) return "";
  return xml
    .replace(/<w:p[ >]/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function unzipEntry(bytes: Uint8Array, want: string): string | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  while (offset + 30 < bytes.length) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break;
    const method = view.getUint16(offset + 8, true);
    const compSize = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + nameLen));
    const dataStart = offset + 30 + nameLen + extraLen;
    const data = bytes.subarray(dataStart, dataStart + compSize);
    if (name === want) {
      if (method === 0) return new TextDecoder().decode(data);
      if (method === 8) {
        try {
          return new TextDecoder().decode(inflateRawSync(data));
        } catch {
          return null;
        }
      }
      return null;
    }
    offset = dataStart + compSize;
  }
  return null;
}
