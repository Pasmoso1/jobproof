export type QuoteTradeProfileFields = {
  quote_primary_trade?: string | null;
  quote_primary_trade_other?: string | null;
};

/**
 * Human-readable trade for display and future AI features.
 * Returns custom label when primary trade is Other; otherwise the primary trade.
 */
export function getEffectiveQuoteTrade(
  profile: QuoteTradeProfileFields | null | undefined
): string | null {
  if (!profile) return null;
  const primary = String(profile.quote_primary_trade ?? "").trim();
  if (!primary) return null;
  if (primary === "Other") {
    const custom = String(profile.quote_primary_trade_other ?? "").trim();
    return custom || null;
  }
  return primary;
}
