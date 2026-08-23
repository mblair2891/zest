import { getSql } from "@/lib/db";
import {
  DEFAULT_FRONT_SETTINGS,
  WAITLIST_REASON_LABEL,
  type FrontSettings,
  type WaitEstimate,
  type WaitlistReason,
} from "./types";

export type WaitSignals = {
  waitingParties: number;
  waitingCovers: number;
  openKitchenTickets: number;
  openTables: number;
  occupiedTables: number;
  reason: WaitlistReason | null;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function heuristicWait(signals: WaitSignals): WaitEstimate {
  let minutes = 8;
  const bits: string[] = [];
  switch (signals.reason) {
    case "at_capacity":
      minutes += 22;
      bits.push("the room is at capacity");
      break;
    case "kitchen_backed_up":
      minutes += 16;
      bits.push("the kitchen is backed up");
      break;
    case "short_kitchen_staff":
      minutes += 14;
      bits.push("the kitchen is short-staffed");
      break;
    case "short_floor_staff":
      minutes += 10;
      bits.push("the floor is short-staffed");
      break;
    case "custom":
      minutes += 10;
      bits.push("the house posted a wait");
      break;
    default:
      bits.push("typical covers");
  }
  if (signals.waitingParties > 0) {
    minutes += signals.waitingParties * 4;
    bits.push(`${signals.waitingParties} part${signals.waitingParties === 1 ? "y" : "ies"} already waiting`);
  }
  if (signals.openKitchenTickets > 0) {
    minutes += Math.min(18, signals.openKitchenTickets * 3);
    bits.push(`${signals.openKitchenTickets} tickets on the rail`);
  }
  if (signals.openTables === 0 && signals.occupiedTables > 0) {
    minutes += 8;
    bits.push("no open tables");
  }
  minutes = clamp(Math.round(minutes), 5, 90);
  const spread = minutes >= 30 ? 8 : 5;
  const low = clamp(minutes - spread, 5, 90);
  const high = clamp(minutes + spread, low + 5, 95);
  return {
    minutes,
    low,
    high,
    label: `about ${low}–${high} min`,
    rationale: bits.join("; "),
    source: "heuristic",
  };
}

const cache = new Map<string, { at: number; value: WaitEstimate }>();

export async function estimateWaitMinutes(opts: {
  locationId: string;
  settings?: FrontSettings;
  openKitchenTickets?: number;
  openTables?: number;
  occupiedTables?: number;
}): Promise<WaitEstimate> {
  const loc = opts.locationId;
  const hit = cache.get(loc);
  if (hit && Date.now() - hit.at < 20_000) return hit.value;

  const sql = await getSql();
  const waiting = await sql<{ n: number; covers: number }>`
    select count(*)::int as n, coalesce(sum(party_size), 0)::int as covers
    from waitlist_entries
    where location_id = ${loc} and status in ('waiting', 'notified')
  `;
  const settings = opts.settings ?? {
    locationId: loc,
    ...DEFAULT_FRONT_SETTINGS,
  };
  const signals: WaitSignals = {
    waitingParties: Number(waiting[0]?.n ?? 0),
    waitingCovers: Number(waiting[0]?.covers ?? 0),
    openKitchenTickets: Math.max(0, opts.openKitchenTickets ?? 0),
    openTables: Math.max(0, opts.openTables ?? 0),
    occupiedTables: Math.max(0, opts.occupiedTables ?? 0),
    reason: settings.waitlistReason,
  };
  let estimate = heuristicWait(signals);

  const key = typeof process !== "undefined" ? process.env.XAI_API_KEY?.trim() : "";
  if (key) {
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          max_tokens: 80,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "You refine a restaurant wait estimate. Reply JSON only: {\"minutes\":number,\"rationale\":\"short\"}. Do not invent precision. Stay within 5–90.",
            },
            {
              role: "user",
              content: JSON.stringify({
                heuristicMinutes: estimate.minutes,
                reason: signals.reason
                  ? WAITLIST_REASON_LABEL[signals.reason]
                  : null,
                waitingParties: signals.waitingParties,
                waitingCovers: signals.waitingCovers,
                openKitchenTickets: signals.openKitchenTickets,
                openTables: signals.openTables,
                occupiedTables: signals.occupiedTables,
              }),
            },
          ],
        }),
      });
      if (res.ok) {
        const body = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const text = body.choices?.[0]?.message?.content ?? "";
        const json = text.match(/\{[\s\S]*\}/)?.[0];
        if (json) {
          const parsed = JSON.parse(json) as { minutes?: number; rationale?: string };
          const minutes = Math.round(Number(parsed.minutes));
          if (Number.isFinite(minutes)) {
            const spread = minutes >= 30 ? 8 : 5;
            const low = Math.max(5, minutes - spread);
            const high = Math.min(95, minutes + spread);
            estimate = {
              minutes: Math.max(5, Math.min(90, minutes)),
              low,
              high,
              label: `about ${low}–${high} min`,
              rationale: String(parsed.rationale || estimate.rationale).slice(0, 180),
              source: "ai",
            };
          }
        }
      }
    } catch {
      /* keep heuristic */
    }
  }

  cache.set(loc, { at: Date.now(), value: estimate });
  return estimate;
}
