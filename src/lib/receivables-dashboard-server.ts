import { createClient } from "@/lib/supabase/server";
import { getEasternMonthYmdRange } from "@/lib/datetime-eastern";
import {
  computeReceivablesDashboard,
  type ReceivableInvoiceInput,
  type ReceivablesDashboardComputed,
} from "@/lib/receivables-dashboard";

export type ReceivablesDashboardData = ReceivablesDashboardComputed;

/**
 * Loads all invoices for the signed-in contractor plus payment totals for the current Eastern month.
 */
export async function getReceivablesDashboardData(): Promise<ReceivablesDashboardData> {
  const empty = computeReceivablesDashboard([], 0);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return empty;

  const { data: invData, error: invErr } = await supabase
    .from("invoices")
    .select(
      `
      id,
      job_id,
      status,
      sent_at,
      due_date,
      paid_at,
      viewed_at,
      balance_due,
      amount_paid_total,
      last_payment_at,
      jobs (
        title,
        contract_status,
        customers (
          full_name
        )
      )
    `
    )
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });

  if (invErr) {
    console.error("[getReceivablesDashboardData] invoices:", invErr.message);
    return empty;
  }

  const { startYmd, endYmd } = getEasternMonthYmdRange();

  const { data: payData, error: payErr } = await supabase
    .from("invoice_payments")
    .select("amount, paid_on")
    .eq("profile_id", profile.id)
    .gte("paid_on", startYmd)
    .lte("paid_on", endYmd);

  if (payErr) {
    console.error("[getReceivablesDashboardData] invoice_payments:", payErr.message);
    return empty;
  }

  let paidThisMonth = 0;
  for (const p of payData ?? []) {
    const a = Number((p as { amount?: unknown }).amount);
    if (Number.isFinite(a) && a > 0) paidThisMonth += a;
  }

  const rows = (invData ?? []) as unknown as ReceivableInvoiceInput[];
  return computeReceivablesDashboard(rows, paidThisMonth);
}
