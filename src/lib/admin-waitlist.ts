import { formatBillingDateTimeEastern } from "@/lib/billing-date-display";
import { getTodayYmdEastern, isoToYmdEastern } from "@/lib/datetime-eastern";

export type WaitlistSignupRow = {
  id: string;
  created_at: string;
  email: string | null;
  province: string | null;
  source: string | null;
  trade: string | null;
  city: string | null;
  heard_about_source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  landing_page: string | null;
  first_seen_at: string | null;
};

export function normalizeAdminEmail(email: string | null | undefined): string {
  return String(email ?? "").trim().toLowerCase();
}

export function formatWaitlistSignupTimeEastern(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatBillingDateTimeEastern(iso) || "—";
}

/** Primary "signup source" for grouping: explicit source, else UTM source, else heard_about. */
export function waitlistSignupSourceLabel(row: Pick<
  WaitlistSignupRow,
  "source" | "utm_source" | "heard_about_source"
>): string {
  const s = String(row.source ?? "").trim();
  if (s) return s;
  const u = String(row.utm_source ?? "").trim();
  if (u) return u;
  const h = String(row.heard_about_source ?? "").trim();
  if (h) return h;
  return "(none)";
}

export function parseWaitlistRows(raw: Record<string, unknown>[]): WaitlistSignupRow[] {
  return raw.map((r) => ({
    id: String(r.id ?? ""),
    created_at: String(r.created_at ?? ""),
    email: r.email != null ? String(r.email) : null,
    province: r.province != null ? String(r.province) : null,
    source: r.source != null ? String(r.source) : null,
    trade: r.trade != null ? String(r.trade) : null,
    city: r.city != null ? String(r.city) : null,
    heard_about_source: r.heard_about_source != null ? String(r.heard_about_source) : null,
    utm_source: r.utm_source != null ? String(r.utm_source) : null,
    utm_medium: r.utm_medium != null ? String(r.utm_medium) : null,
    utm_campaign: r.utm_campaign != null ? String(r.utm_campaign) : null,
    utm_content: r.utm_content != null ? String(r.utm_content) : null,
    utm_term: r.utm_term != null ? String(r.utm_term) : null,
    referrer: r.referrer != null ? String(r.referrer) : null,
    landing_page: r.landing_page != null ? String(r.landing_page) : null,
    first_seen_at: r.first_seen_at != null ? String(r.first_seen_at) : null,
  }));
}

export type WaitlistSummary = {
  total: number;
  signupsTodayEastern: number;
  signupsLast7DaysRolling: number;
  topProvince: string;
  topSource: string;
};

function topLabelFromCounts(counts: Map<string, number>, fallback: string): string {
  let best = fallback;
  let bestN = -1;
  for (const [k, n] of counts) {
    if (n > bestN) {
      bestN = n;
      best = k;
    }
  }
  return best;
}

export function computeWaitlistSummary(rows: WaitlistSignupRow[]): WaitlistSummary {
  const todayYmd = getTodayYmdEastern();
  const cutoffMs = Date.now() - 7 * 86400000;
  let signupsToday = 0;
  let signups7d = 0;
  const byProvince = new Map<string, number>();
  const bySource = new Map<string, number>();

  for (const row of rows) {
    const created = row.created_at;
    if (created) {
      try {
        const t = new Date(created).getTime();
        if (!Number.isNaN(t) && t >= cutoffMs) signups7d += 1;
      } catch {
        /* ignore */
      }
      const ymd = isoToYmdEastern(created);
      if (ymd && ymd === todayYmd) signupsToday += 1;
    }

    const prov = String(row.province ?? "").trim() || "(none)";
    byProvince.set(prov, (byProvince.get(prov) ?? 0) + 1);

    const src = waitlistSignupSourceLabel(row);
    bySource.set(src, (bySource.get(src) ?? 0) + 1);
  }

  return {
    total: rows.length,
    signupsTodayEastern: signupsToday,
    signupsLast7DaysRolling: signups7d,
    topProvince: topLabelFromCounts(byProvince, "—"),
    topSource: topLabelFromCounts(bySource, "—"),
  };
}

export type WaitlistFilters = {
  q: string;
  province: string;
  source: string;
};

export function filterWaitlistRows(rows: WaitlistSignupRow[], filters: WaitlistFilters): WaitlistSignupRow[] {
  const q = normalizeAdminEmail(filters.q).replace(/^mailto:/i, "");
  const prov = String(filters.province ?? "").trim();
  const src = String(filters.source ?? "").trim();

  return rows.filter((row) => {
    if (q) {
      const em = normalizeAdminEmail(row.email);
      if (!em.includes(q)) return false;
    }
    if (prov && String(row.province ?? "").trim() !== prov) return false;
    if (src && waitlistSignupSourceLabel(row) !== src) return false;
    return true;
  });
}

export function sortWaitlistNewestFirst(rows: WaitlistSignupRow[]): WaitlistSignupRow[] {
  return [...rows].sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  });
}

function csvEscapeCell(value: string): string {
  const v = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function waitlistRowsToCsv(rows: WaitlistSignupRow[]): string {
  const header = ["email", "province", "source", "created_at"];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        csvEscapeCell(normalizeAdminEmail(row.email)),
        csvEscapeCell(String(row.province ?? "").trim()),
        csvEscapeCell(waitlistSignupSourceLabel(row)),
        csvEscapeCell(row.created_at),
      ].join(",")
    );
  }
  return lines.join("\r\n");
}

/** Map lowercase email → profile id (auth email or business contact email). */
export function buildEmailToProfileId(input: {
  profiles: Array<{ id: string; user_id: string; business_contact_email?: string | null }>;
  authEmailByUserId: Map<string, string>;
}): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of input.profiles) {
    const pid = String(p.id);
    const authEm = normalizeAdminEmail(input.authEmailByUserId.get(p.user_id));
    if (authEm) out.set(authEm, pid);
    const biz = normalizeAdminEmail(p.business_contact_email);
    if (biz) out.set(biz, pid);
  }
  return out;
}

/** Paginated auth users: user_id → email (for admin conversion matching). */
export async function fetchAuthEmailsByUserIdForAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) break;
    for (const u of data.users) out.set(u.id, u.email ?? "");
    if (data.users.length < perPage) break;
    page += 1;
  }
  return out;
}
