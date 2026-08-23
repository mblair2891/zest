import type {
  CostVsOrderingRow,
  InsightFinding,
  InsightRecommendation,
  LocationInsights,
  LocationMetrics,
} from "./types";

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function guidedInsights(m: LocationMetrics): LocationInsights {
  const findings: InsightFinding[] = [];
  const recs: InsightRecommendation[] = [];
  const costVsOrdering: CostVsOrderingRow[] = [];
  const risks: string[] = [];
  const dataGaps: string[] = [];
  let score = 82;

  const sales = m.sales.netCents;
  const voidRate = sales > 0 ? m.payments.voidsCents / sales : 0;
  const compRate = sales > 0 ? m.payments.compsCents / sales : 0;
  const kitMin = m.tickets.kitchenAvgSec / 60;
  const barMin = m.tickets.barAvgSec / 60;

  if (m.sales.closedChecks < 3) {
    dataGaps.push("Few closed checks in this range — treat scores as directional.");
    score -= 8;
  }

  if (voidRate > 0.05) {
    score -= 12;
    findings.push({
      area: "Revenue quality",
      severity: "urgent",
      observation: `Voids are ${(voidRate * 100).toFixed(1)}% of sales.`,
      evidence: `${m.payments.voidsCents}¢ voids on ${sales}¢ net.`,
    });
    recs.push({
      priority: "now",
      action: "Review void audit with managers before the next rush.",
      expectedImpact: "Protect net sales and catch training or theft patterns.",
      ownerRole: "manager",
      applyView: "reports",
    });
  } else if (voidRate > 0.02) {
    score -= 5;
    findings.push({
      area: "Revenue quality",
      severity: "watch",
      observation: `Void rate ${(voidRate * 100).toFixed(1)}% is elevated.`,
      evidence: "Watch comps and voids together on the close.",
    });
  }

  if (compRate > 0.04) {
    score -= 8;
    findings.push({
      area: "Revenue quality",
      severity: "watch",
      observation: `Comps are ${(compRate * 100).toFixed(1)}% of sales.`,
      evidence: "Comps need a manager PIN; audit who is using it.",
    });
    recs.push({
      priority: "soon",
      action: "Cap informal comps; require a reason on every comp.",
      expectedImpact: "Lower giveaway without hurting recovery.",
      ownerRole: "owner",
      applyView: "settings",
    });
  }

  if (kitMin >= 12) {
    score -= 10;
    findings.push({
      area: "Speed of service",
      severity: "urgent",
      observation: `Kitchen tickets average ${kitMin.toFixed(1)} minutes to bump.`,
      evidence: `${m.tickets.kitchenOpen} open · ${m.tickets.kitchenReady} ready.`,
    });
    recs.push({
      priority: "now",
      action: "Staff the pit or 86 slow items before the next peak daypart.",
      expectedImpact: "Shorter ticket times and fewer walkouts.",
      ownerRole: "kitchen",
      applyView: "kitchen",
    });
    risks.push("Long ticket times will show up as waitlist pressure.");
  } else if (kitMin >= 8) {
    score -= 4;
    findings.push({
      area: "Speed of service",
      severity: "watch",
      observation: `Kitchen average ${kitMin.toFixed(1)} min — watch the next rush.`,
      evidence: `${m.tickets.kitchenOpen} tickets still open.`,
    });
  }

  if (barMin >= 8) {
    score -= 6;
    findings.push({
      area: "Speed of service",
      severity: "watch",
      observation: `Bar tickets average ${barMin.toFixed(1)} minutes.`,
      evidence: `${m.tickets.barOpen} open on the well.`,
    });
    recs.push({
      priority: "soon",
      action: "Simplify the well list or add a barback for the peak hour.",
      expectedImpact: "Faster drink fire, less table idle.",
      ownerRole: "bartender",
      applyView: "bar",
    });
  }

  if (m.guest.waitlistWaiting >= 6) {
    score -= 6;
    findings.push({
      area: "Guest flow",
      severity: m.guest.waitlistWaiting >= 12 ? "urgent" : "watch",
      observation: `${m.guest.waitlistWaiting} parties waiting. Quoted average ${m.guest.waitlistQuotedAvg} min.`,
      evidence: `${m.guest.waitlistSeated} seated this range · ${m.guest.noShows} no-shows.`,
    });
    recs.push({
      priority: "now",
      action: "Tighten quoted waits or open a section. Check waitlist reason on Host stand.",
      expectedImpact: "Fewer abandoned quotes.",
      ownerRole: "host",
      applyView: "waitlist",
    });
  }

  if (m.guest.noShows >= 3) {
    findings.push({
      area: "Guest flow",
      severity: "watch",
      observation: `${m.guest.noShows} no-shows on waitlist/reservations.`,
      evidence: "Quoted wait vs actual seating is the lever.",
    });
  }

  const cashShare =
    m.payments.cardCents + m.payments.cashCents > 0
      ? m.payments.cashCents / (m.payments.cardCents + m.payments.cashCents)
      : 0;
  if (m.payments.cashDiscountCostCents > 0) {
    findings.push({
      area: "Money path",
      severity: "info",
      observation: `Cash discount cost ${m.payments.cashDiscountCostCents}¢ this range.`,
      evidence: `Cash share ${(cashShare * 100).toFixed(0)}% of card+cash. Quantum Payments remains the card.`,
    });
  }

  const top = m.sales.byItem[0];
  if (top && sales > 0 && top.cents / sales > 0.4) {
    score -= 5;
    findings.push({
      area: "Product mix",
      severity: "watch",
      observation: `${top.name} is ${((top.cents / sales) * 100).toFixed(0)}% of sales.`,
      evidence: "Concentration risk if 86'd or delayed.",
    });
    recs.push({
      priority: "later",
      action: `Build a second mover next to ${top.name} so the mix is not one SKU.`,
      expectedImpact: "Less 86 panic; more even prep.",
      ownerRole: "owner",
      applyView: "menu",
    });
    risks.push("Mix concentration — one 86 can crater the night.");
  }

  if (m.hostMulti && m.multiOp.byOperator.length >= 2) {
    const a = m.multiOp.byOperator[0]!;
    const b = m.multiOp.byOperator[1]!;
    const total = a.cents + b.cents || 1;
    findings.push({
      area: "Multi-operator",
      severity: "info",
      observation: `${a.name} ${((a.cents / total) * 100).toFixed(0)}% / ${b.name} ${((b.cents / total) * 100).toFixed(0)}% of tagged merchandise.`,
      evidence: `Host cut on last period ${m.multiOp.hostCutCents}¢. Guest still pays once.`,
    });
  }

  const servers = m.staff.clocked.find((c) => c.role === "server")?.count ?? 0;
  if (m.guest.waitlistWaiting >= 8 && servers <= 2) {
    score -= 7;
    findings.push({
      area: "Staffing stress",
      severity: "urgent",
      observation: `Waitlist is long with only ${servers} server(s) on.`,
      evidence: "Waitlist reason and ticket delay should agree before you add a section.",
    });
    recs.push({
      priority: "now",
      action: "Call a server or hold seating until tickets clear.",
      expectedImpact: "Protect ticket times and quotes.",
      ownerRole: "manager",
      applyView: "employees",
    });
  }

  const eightySix = m.tickets.eightySix;
  if (eightySix.length) {
    const dead = eightySix.filter((x) => !m.sales.byItem.some((i) => i.name === x.name && i.qty > 2));
    if (dead.length) {
      costVsOrdering.push({
        itemOrCategory: dead.map((d) => d.name).join(", "),
        salesTrend: "Low or none while 86'd",
        costSignal: "Possible over-prep or over-ordering earlier",
        issue: "86 with weak sales — not a stockout of a mover.",
        recommendation: "Cut prep par; do not reorder until the item moves.",
      });
    }
  }

  if (m.cost.dataCoverage < 0.15) {
    dataGaps.push(m.cost.note);
    costVsOrdering.push({
      itemOrCategory: "Menu",
      salesTrend: m.sales.byItem[0] ? `${m.sales.byItem[0].name} leads` : "Thin sales",
      costSignal: "Insufficient cost data",
      issue: "Cannot compute true food/pour cost without recipe or inventory cost.",
      recommendation: "Link inventory cost to top sellers. Do not invent a food-cost %.",
    });
  } else {
    for (const row of m.cost.items.slice(0, 8)) {
      if (row.costCents == null || row.marginBps == null) continue;
      if (row.marginBps < 2500 && row.qty >= 3) {
        costVsOrdering.push({
          itemOrCategory: row.name,
          salesTrend: `Sold ×${row.qty}`,
          costSignal: `Margin ${(row.marginBps / 100).toFixed(0)}% from inventory cost`,
          issue: "High velocity, thin margin.",
          recommendation: "Raise price a step or recost the recipe — do not auto-change the menu.",
        });
        recs.push({
          priority: "soon",
          action: `Review price or recipe on ${row.name} (thin margin).`,
          expectedImpact: "Protect contribution without guessing inventory counts.",
          ownerRole: "owner",
          applyView: "menu",
        });
      }
    }
  }

  if (m.staff.agingOpen.some((a) => a.minutes >= 90)) {
    findings.push({
      area: "Staff / service",
      severity: "watch",
      observation: "Checks open longer than 90 minutes.",
      evidence: m.staff.agingOpen
        .filter((a) => a.minutes >= 90)
        .map((a) => `#${a.number} ${a.minutes}m`)
        .join(", "),
    });
  }

  if (!findings.length) {
    findings.push({
      area: "Overall",
      severity: "info",
      observation: "No urgent flags in this range.",
      evidence: `${m.sales.closedChecks} closed checks · ${m.locationName}.`,
    });
  }

  if (!recs.length) {
    recs.push({
      priority: "later",
      action: "Keep closing the period and watching ticket times.",
      expectedImpact: "Baseline holds.",
      ownerRole: "manager",
      applyView: "reports",
    });
  }

  const summary = `${m.locationName}: ${m.sales.closedChecks} closed checks, net ${(m.sales.netCents / 100).toFixed(0)} in range. Health ${clamp(score, 0, 100)}. ${dataGaps[0] ?? "Guided insights from live metrics — not invented counts."}`;

  return {
    summary,
    healthScore: clamp(Math.round(score), 0, 100),
    findings: findings.slice(0, 10),
    costVsOrdering: costVsOrdering.slice(0, 8),
    recommendations: recs.slice(0, 8),
    risks: risks.slice(0, 6),
    source: "guided",
    dataGaps,
  };
}
