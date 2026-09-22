/**
 * Browser-side derivatives: original, screen PNG/SVG, receipt 1-bit raster.
 * Called from the upload control. The server stores what this returns.
 */
import {
  LOGO_MAX_BYTES,
  RECEIPT_MAX_W,
  RECEIPT_MIN_W,
  acceptUpload,
  normalizeLogoMime,
  type LogoMime,
  type ReceiptRaster,
} from "./logos";

export type PreparedLogo = {
  mime: LogoMime;
  originalBase64: string;
  screenUrl: string;
  receipt: ReceiptRaster | null;
};

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function loadImage(bytes: Uint8Array, mime: LogoMime): Promise<HTMLImageElement> {
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  const blob = new Blob([ab], { type: mime });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that file"));
    };
    img.src = url;
  });
}

function drawFit(img: HTMLImageElement, maxW: number, maxH: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, maxW / Math.max(1, img.naturalWidth), maxH / Math.max(1, img.naturalHeight));
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that file");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function packReceipt(canvas: HTMLCanvasElement): ReceiptRaster | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const { width, height } = canvas;
  if (width < 8 || height < 8) return null;
  const data = ctx.getImageData(0, 0, width, height).data;
  const rowBytes = Math.ceil(width / 8);
  const rows = new Uint8Array(rowBytes * height);
  let black = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const a = data[i + 3] ?? 0;
      const r = data[i] ?? 255;
      const g = data[i + 1] ?? 255;
      const b = data[i + 2] ?? 255;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const on = a >= 128 && lum < 150;
      if (!on) continue;
      black += 1;
      rows[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  const ratio = black / (width * height);
  if (ratio < 0.01 || ratio > 0.82) return null;
  if (width < RECEIPT_MIN_W || width > RECEIPT_MAX_W) return null;
  return { width, height, rowsBase64: bytesToBase64(rows) };
}

export async function prepareLogoFile(file: File): Promise<PreparedLogo> {
  const mime = normalizeLogoMime(file.type || "");
  const gate = acceptUpload({ mime: mime || file.type, byteLength: file.size });
  if (!gate.ok || !mime) throw new Error(gate.ok ? "Use a PNG, JPG, or SVG" : gate.error);
  if (file.size > LOGO_MAX_BYTES) throw new Error("Logo must be 2MB or smaller");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const originalBase64 = bytesToBase64(bytes);
  const img = await loadImage(bytes, mime);
  const screen = drawFit(img, 480, 160);
  const screenUrl = screen.toDataURL("image/png");
  let receipt: ReceiptRaster | null = null;
  try {
    const wide = Math.min(RECEIPT_MAX_W, Math.max(RECEIPT_MIN_W, img.naturalWidth || RECEIPT_MIN_W));
    const thermal = drawFit(img, wide, 120);
    if (thermal.width < RECEIPT_MIN_W) {
      const padded = document.createElement("canvas");
      padded.width = RECEIPT_MIN_W;
      padded.height = Math.max(8, thermal.height);
      const ctx = padded.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, padded.width, padded.height);
        const x = Math.round((padded.width - thermal.width) / 2);
        ctx.drawImage(thermal, x, 0);
      }
      receipt = packReceipt(padded);
    } else {
      receipt = packReceipt(thermal);
    }
  } catch {
    receipt = null;
  }
  if (mime === "image/svg+xml" && screenUrl.length > 180_000) {
    const svg = new TextDecoder().decode(bytes);
    return {
      mime,
      originalBase64,
      screenUrl: `data:image/svg+xml;base64,${bytesToBase64(new TextEncoder().encode(svg))}`,
      receipt,
    };
  }
  return { mime, originalBase64, screenUrl, receipt };
}
