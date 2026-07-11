import {
  QUOTE_ADDITIONAL_TRADE_OPTIONS,
  QUOTE_PRIMARY_TRADES,
  type QuotePrimaryTrade,
} from "@/lib/quote-requests/constants";
import {
  countTotalTrades,
  SOLO_TRADE_LIMIT_UPGRADE_MESSAGE,
} from "@/lib/plan-entitlements";

/** Absolute catalog ceiling (Pro / unlimited plans). */
const MAX_ADDITIONAL_TRADES_CATALOG = 10;

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

  if (result.length > MAX_ADDITIONAL_TRADES_CATALOG) {
    return {
      value: [],
      error: `Select at most ${MAX_ADDITIONAL_TRADES_CATALOG} additional trades.`,
    };
  }

  return { value: result };
}

/**
 * Enforce plan trade caps (primary + additional).
 * Grandfathering: over-limit accounts may keep or reduce existing selections,
 * but cannot increase total trade count.
 */
export function enforcePlanTradeLimit(input: {
  primaryTrade: string | null;
  additionalTrades: readonly string[];
  maxTotalTrades: number | null;
  previousTotalTrades?: number | null;
}): { ok: true } | { ok: false; error: string } {
  if (input.maxTotalTrades === null) {
    return { ok: true };
  }

  const total = countTotalTrades(input.primaryTrade, input.additionalTrades);
  if (total <= input.maxTotalTrades) {
    return { ok: true };
  }

  const previous =
    input.previousTotalTrades != null && Number.isFinite(input.previousTotalTrades)
      ? input.previousTotalTrades
      : null;

  // Allow saving an existing over-limit set when the contractor is not adding trades.
  if (previous !== null && total <= previous) {
    return { ok: true };
  }

  return { ok: false, error: SOLO_TRADE_LIMIT_UPGRADE_MESSAGE };
}

export function validateContractorTradesFields(input: {
  primaryTrade: string;
  primaryTradeOther: string;
  additionalTrades: string[];
  primaryTradeRequired: boolean;
  maxTotalTrades?: number | null;
  previousTotalTrades?: number | null;
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

  if (!additionalResult.error && input.maxTotalTrades !== undefined) {
    const planCheck = enforcePlanTradeLimit({
      primaryTrade,
      additionalTrades: additionalResult.value,
      maxTotalTrades: input.maxTotalTrades,
      previousTotalTrades: input.previousTotalTrades,
    });
    if (!planCheck.ok) {
      fieldErrors.additionalTrades = planCheck.error;
    }
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
