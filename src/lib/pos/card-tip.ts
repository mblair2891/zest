/** Card-present tip choices. Pure helpers so station tests can import this file. */

export const CARD_TIP_PERCENTS = [18, 20, 25] as const;

export type CardTipPercent = (typeof CARD_TIP_PERCENTS)[number];

export type CardTipChoice =
  | { kind: "percent"; percent: CardTipPercent }
  | { kind: "custom-amount"; cents: number }
  | { kind: "custom-percent"; percent: number }
  | { kind: "none" };

export type TipKeyMode = "amount" | "percent";

export function tipCentsForPercent(baseCents: number, percent: number): number {
  const base = Math.round(baseCents);
  if (!Number.isFinite(base) || base <= 0) return 0;
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.round(base * (percent / 100));
}

export function tipCentsForChoice(choice: CardTipChoice, baseCents: number): number {
  if (choice.kind === "none") return 0;
  if (choice.kind === "custom-amount") {
    const cents = Math.round(choice.cents);
    return Number.isFinite(cents) && cents > 0 ? cents : 0;
  }
  return tipCentsForPercent(baseCents, choice.percent);
}

export function cardChargeCents(baseCents: number, tipCents: number): number {
  const base = Math.round(baseCents);
  const tip = Math.round(tipCents);
  const safeBase = Number.isFinite(base) && base > 0 ? base : 0;
  const safeTip = Number.isFinite(tip) && tip > 0 ? tip : 0;
  return safeBase + safeTip;
}

/** Money keypad buffer is digits read as cents. "500" is $5.00. */
export function centsFromMoneyDigits(digits: string): number {
  const clean = digits.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 7);
  if (!clean) return 0;
  return Number.parseInt(clean, 10);
}

/** Percent keypad. One decimal place, 0 through 100. */
export function percentFromDigits(raw: string): number | null {
  const clean = raw.trim();
  if (!clean || clean === ".") return null;
  if (!/^\d+(\.\d+)?$/.test(clean) && !/^\d+\.$/.test(clean)) return null;
  const n = Number.parseFloat(clean);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 10) / 10;
}

export function appendTipKey(buffer: string, key: string, mode: TipKeyMode): string {
  if (key === "clear") return "";
  if (key === "back") return buffer.slice(0, -1);
  if (mode === "amount") {
    if (!/^\d$/.test(key)) return buffer;
    const next = `${buffer}${key}`.replace(/^0+(?=\d)/, "");
    return next.length > 7 ? buffer : next;
  }
  if (key === ".") {
    if (buffer.includes(".")) return buffer;
    return buffer === "" ? "0." : `${buffer}.`;
  }
  if (!/^\d$/.test(key)) return buffer;
  const next = `${buffer}${key}`.replace(/^0+(?=\d)/, "");
  const frac = next.split(".")[1];
  if (frac && frac.length > 1) return buffer;
  const pct = Number.parseFloat(next);
  if (!Number.isFinite(pct) || pct > 100) return buffer;
  return next;
}

/** Null when the buffer is empty. Zero is a real entry (no tip). */
export function tipFromKeypad(
  buffer: string,
  mode: TipKeyMode,
  baseCents: number,
): number | null {
  if (!buffer) return null;
  if (mode === "amount") return centsFromMoneyDigits(buffer);
  const pct = percentFromDigits(buffer);
  if (pct == null) return null;
  return tipCentsForPercent(baseCents, pct);
}
