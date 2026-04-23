/** Pre-tax subtotal + decimal tax rate → stored tax_amount and total (matches invoice rounding). */
export function computeEstimateTotals(
  subtotal: number,
  taxRate: number
): { taxAmount: number; total: number } {
  const s = Number.isFinite(subtotal) && subtotal >= 0 ? subtotal : 0;
  const r = Number.isFinite(taxRate) && taxRate >= 0 ? taxRate : 0;
  const taxAmount = Math.round(s * r * 100) / 100;
  const total = Math.round((s + taxAmount) * 100) / 100;
  return { taxAmount, total };
}
