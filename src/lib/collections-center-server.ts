import { createClient } from "@/lib/supabase/server";
import {
  buildCollectionsCenterPayload,
  type CollectionsCenterPayload,
} from "@/lib/collections-center";
import {
  invoiceCountsTowardOutstanding,
  normalizeReceivableRow,
} from "@/lib/receivables-dashboard";
import { fetchContractorReceivableInvoiceInputs } from "@/lib/receivables-dashboard-server";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function loadReminderMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
  invoiceIds: string[]
): Promise<
  Map<string, { lastSuccessAt: string | null; lastSuccessSource: "manual" | "automation" | null }>
> {
  const map = new Map<
    string,
    { lastSuccessAt: string | null; lastSuccessSource: "manual" | "automation" | null }
  >();
  if (invoiceIds.length === 0) return map;

  for (const part of chunk(invoiceIds, 80)) {
    const { data, error } = await supabase
      .from("invoice_reminder_sends")
      .select("invoice_id, created_at, email_status, source")
      .eq("profile_id", profileId)
      .in("invoice_id", part)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[getCollectionsCenterData] invoice_reminder_sends:", error.message);
      continue;
    }

    for (const r of data ?? []) {
      const iid = String((r as { invoice_id?: string }).invoice_id ?? "");
      if (!iid || map.has(iid)) continue;
      const emailStatus = String((r as { email_status?: string }).email_status ?? "");
      if (emailStatus !== "success") continue;
      const createdAt = String((r as { created_at?: string }).created_at ?? "");
      const sourceRaw = String((r as { source?: string }).source ?? "");
      const lastSuccessSource =
        sourceRaw === "automation" || sourceRaw === "manual" ? sourceRaw : null;
      map.set(iid, { lastSuccessAt: createdAt || null, lastSuccessSource });
    }
  }

  return map;
}

async function loadLatestPaymentMethodMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
  invoiceIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (invoiceIds.length === 0) return map;

  for (const part of chunk(invoiceIds, 80)) {
    const { data, error } = await supabase
      .from("invoice_payments")
      .select("invoice_id, payment_method, created_at")
      .eq("profile_id", profileId)
      .in("invoice_id", part)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[getCollectionsCenterData] invoice_payments:", error.message);
      continue;
    }

    for (const r of data ?? []) {
      const iid = String((r as { invoice_id?: string }).invoice_id ?? "");
      if (!iid || map.has(iid)) continue;
      const method = String((r as { payment_method?: string }).payment_method ?? "");
      if (method) map.set(iid, method);
    }
  }

  return map;
}

export async function getCollectionsCenterData(): Promise<CollectionsCenterPayload> {
  const empty = buildCollectionsCenterPayload([], new Map(), new Map());
  const pack = await fetchContractorReceivableInvoiceInputs();
  if (!pack) return empty;

  const { profileId, rows: invoiceInputs } = pack;
  const supabase = await createClient();

  const normalizedIds = invoiceInputs
    .map(normalizeReceivableRow)
    .filter((r) => invoiceCountsTowardOutstanding(r.status, r.balanceDue))
    .map((r) => r.invoiceId)
    .filter(Boolean);

  const [reminderMap, payMethodMap] = await Promise.all([
    loadReminderMap(supabase, profileId, normalizedIds),
    loadLatestPaymentMethodMap(supabase, profileId, normalizedIds),
  ]);

  return buildCollectionsCenterPayload(invoiceInputs, reminderMap, payMethodMap);
}
