import {
  QUOTE_ADDITIONAL_TRADE_OPTIONS,
  QUOTE_PRIMARY_TRADES,
  type QuotePrimaryTrade,
} from "@/lib/quote-requests/constants";

const MAX_ADDITIONAL_TRADES = 10;

export function parseQuotePrimaryTrade(raw: string): QuotePrimaryTrade | null {
  const v = raw.trim();
  return (QUOTE_PRIMARY_TRADES as readonly string[]).includes(v) ? (v as QuotePrimaryTrade) : null;
}

export function parseAdditionalTrades(
  raw: string[],
  primaryTrade: QuotePrimaryTrade | null
): { value: QuotePrimaryTrade[]; error?: string } {
  const seen = new Set<string>();
  const result: QuotePrimaryTrade[] = [];

  for (const item of raw) {
    const trade = item.trim();
    if (!trade) continue;

    if (!(QUOTE_ADDITIONAL_TRADE_OPTIONS as readonly string[]).includes(trade)) {
      return { value: [], error: "One or more additional trades are invalid." };
    }

    if (primaryTrade && trade === primaryTrade) {
      return {
        value: [],
        error: "Additional trades cannot include your primary trade.",
      };
    }

    if (seen.has(trade)) {
      return { value: [], error: "Remove duplicate additional trades." };
    }

    seen.add(trade);
    result.push(trade as QuotePrimaryTrade);
  }

  if (result.length > MAX_ADDITIONAL_TRADES) {
    return {
      value: [],
      error: `Select at most ${MAX_ADDITIONAL_TRADES} additional trades.`,
    };
  }

  return { value: result };
}

export function validateContractorTradesFields(input: {
  primaryTrade: string;
  primaryTradeOther: string;
  additionalTrades: string[];
  primaryTradeRequired: boolean;
}): {
  ok: true;
  data: {
    primaryTrade: QuotePrimaryTrade | null;
    primaryTradeOther: string | null;
    additionalTrades: QuotePrimaryTrade[];
  };
} | { ok: false; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  const primaryRaw = input.primaryTrade.trim();

  let primaryTrade: QuotePrimaryTrade | null = null;
  if (!primaryRaw) {
    if (input.primaryTradeRequired) {
      fieldErrors.primaryTrade = "Select a primary trade.";
    } else if (input.additionalTrades.some((t) => t.trim())) {
      fieldErrors.primaryTrade = "Select a primary trade before adding additional trades.";
    }
  } else {
    primaryTrade = parseQuotePrimaryTrade(primaryRaw);
    if (!primaryTrade) {
      fieldErrors.primaryTrade = "Select a valid primary trade.";
    }
  }

  let primaryTradeOther: string | null = null;
  if (primaryTrade === "Other") {
    const custom = input.primaryTradeOther.trim();
    if (!custom) {
      fieldErrors.primaryTradeOther = "Please specify your trade.";
    } else if (custom.length > 80) {
      fieldErrors.primaryTradeOther = "Trade name must be 80 characters or less.";
    } else {
      primaryTradeOther = custom;
    }
  }

  const additionalResult = parseAdditionalTrades(input.additionalTrades, primaryTrade);
  if (additionalResult.error) {
    fieldErrors.additionalTrades = additionalResult.error;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    data: {
      primaryTrade,
      primaryTradeOther,
      additionalTrades: additionalResult.value,
    },
  };
}
