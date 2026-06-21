/** Non-React helper so admin dashboards can compute rolling windows without render-purity lint noise. */
export function countRecordsCreatedInLastDays(
  records: Array<{ created_at: string }>,
  days: number
): number {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  return records.filter((r) => r.created_at >= cutoff).length;
}
