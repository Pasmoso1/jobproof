/** Balance remaining after deposit (contract total − deposit), floored at zero. */
export function balanceDueOnCompletion(
  contractTotal: number | null | undefined,
  depositAmount: number | null | undefined
): number | null {
  const total =
    contractTotal != null && Number.isFinite(Number(contractTotal)) && Number(contractTotal) > 0
      ? Number(contractTotal)
      : null;
  if (total == null) return null;
  const dep =
    depositAmount != null && Number.isFinite(Number(depositAmount)) && Number(depositAmount) > 0
      ? Number(depositAmount)
      : 0;
  return Math.max(0, total - dep);
}
