import { DEFAULT_PRICING_RULES, generateQuote } from "./pricing";
import { DEFAULT_QUOTE_CATALOG, parseQuoteCatalog } from "./quote-catalog";
import type { QuoteCatalog, QuoteSnapshot } from "./prospect-types";
import { buildAssumptions, sessionToIntake } from "./qualify-engine";
import type { QualifySession } from "./qualify-session";

export function quoteFromQualifySession(
  session: QualifySession,
  catalog: QuoteCatalog = DEFAULT_QUOTE_CATALOG,
): QuoteSnapshot {
  const answers = sessionToIntake(session);
  const rules = { ...DEFAULT_PRICING_RULES, quoteCatalog: parseQuoteCatalog(catalog) };
  const quote = generateQuote(answers, rules, { draft: true });
  const assumptions = buildAssumptions(session);
  return {
    ...quote,
    assumptions: [...assumptions, ...quote.assumptions.filter((a) => !assumptions.includes(a))].slice(0, 24),
    featureList: assumptions,
  };
}
