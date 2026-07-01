export type QuoteTradeProfileFields = {
  quote_primary_trade?: string | null;
  quote_primary_trade_other?: string | null;
  quote_additional_trades?: string[] | null;
};

export function normalizeAdditionalTrades(
  value: string[] | null | undefined
): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((trade) => typeof trade === "string" && trade.trim().length > 0);
}

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
