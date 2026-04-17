import { invoiceTaxShortLabel, taxRateFromPropertyProvince } from "@/lib/invoice-tax";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ContractPricingBreakdown = {
  subtotalPreTax: number;
  taxRate: number;
  taxShortLabel: string;
  taxAmount: number;
  totalIncludingTax: number;
  depositApplied: number;
  balanceDueOnCompletion: number;
};

/**
 * Contract `price` in the database is the pre-tax subtotal (same basis as invoice subtotal).
 * Tax uses `taxRateOverride` when set (e.g. builder form); otherwise job property province.
 */
export function computeContractPricingBreakdown(
  subtotalPreTax: number | null | undefined,
  depositAmount: number | null | undefined,
  propertyProvince: string | null | undefined,
  taxRateOverride?: number | null
): ContractPricingBreakdown | null {
  const sub =
    subtotalPreTax != null &&
    Number.isFinite(Number(subtotalPreTax)) &&
    Number(subtotalPreTax) > 0
      ? Number(subtotalPreTax)
      : null;
  if (sub == null) return null;

  const rate =
    taxRateOverride != null &&
    Number.isFinite(Number(taxRateOverride)) &&
    Number(taxRateOverride) >= 0
      ? Number(taxRateOverride)
      : taxRateFromPropertyProvince(propertyProvince);
  const taxAmount = roundMoney(sub * rate);
  const totalIncludingTax = roundMoney(sub + taxAmount);
  const depRaw =
    depositAmount != null &&
    Number.isFinite(Number(depositAmount)) &&
    Number(depositAmount) > 0
      ? Number(depositAmount)
      : 0;
  const depositApplied = roundMoney(Math.min(depRaw, totalIncludingTax));
  const balanceDueOnCompletion = roundMoney(
    Math.max(0, totalIncludingTax - depositApplied)
  );

  const pct = rate * 100;
  const pctStr =
    Math.abs(pct - Math.round(pct)) < 1e-9
      ? String(Math.round(pct))
      : pct.toFixed(3).replace(/\.?0+$/, "");
  const taxShortLabel =
    taxRateOverride != null &&
    Number.isFinite(Number(taxRateOverride)) &&
    Number(taxRateOverride) >= 0
      ? `${pctStr}%`
      : invoiceTaxShortLabel(propertyProvince);

  return {
    subtotalPreTax: sub,
    taxRate: rate,
    taxShortLabel,
    taxAmount,
    totalIncludingTax,
    depositApplied,
    balanceDueOnCompletion,
  };
}

export function formatContractMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `$${Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
