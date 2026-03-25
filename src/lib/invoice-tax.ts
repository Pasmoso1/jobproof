/** Ontario-style default when job has no tax rate and client sends no valid rate. */
export const DEFAULT_INVOICE_TAX_RATE = 0.13;

export function resolveInvoiceTaxRate(
  clientTaxRate: number,
  jobTaxRate: number | null | undefined
): number {
  const c = Number(clientTaxRate);
  if (Number.isFinite(c) && c >= 0) return c;
  const j = jobTaxRate != null ? Number(jobTaxRate) : NaN;
  if (Number.isFinite(j) && j >= 0) return j;
  return DEFAULT_INVOICE_TAX_RATE;
}
