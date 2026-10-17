/**
 * Pure helpers for the admin "Product usage" page (moved out of the old monolithic /admin
 * dashboard). No I/O, so the recent-activity and owner-resolution rules are unit-testable.
 */

type Row = Record<string, unknown>;

export function toMaybeString(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}

export function formatAdminDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

export function groupCounts(values: string[]): Array<{ label: string; count: number }> {
  const m = new Map<string, number>();
  for (const v of values) {
    const key = v.trim() || "(none)";
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export function sourceTuple(a: {
  source?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  heard_about_source?: string | null;
}): string {
  const src = toMaybeString(a.utm_source) ?? toMaybeString(a.source) ?? "(none)";
  const med = toMaybeString(a.utm_medium) ?? "(none)";
  const camp = toMaybeString(a.utm_campaign) ?? "(none)";
  const heard = toMaybeString(a.heard_about_source) ?? "(none)";
  return `${src} | ${med} | ${camp} | heard: ${heard}`;
}

export function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

export type ActivityEvent = { at: string; label: string; pid: string };

export type ActivitySources = {
  profiles: ReadonlyArray<{ id: string; created_at: string }>;
  jobs: readonly Row[];
  contracts: readonly Row[];
  estimates: readonly Row[];
  invoices: readonly Row[];
  payments: readonly Row[];
};

/**
 * Newest-first activity across the product.
 *
 * `allowedProfileIds` scopes the feed to the profiles the page is currently filtering to
 * (e.g. beta testers only), so the feed always agrees with the filter. Owner names are
 * resolved separately from the FULL profile map — see {@link resolveActivityOwner}.
 */
export function buildActivityFeed(
  src: ActivitySources,
  options: { allowedProfileIds?: ReadonlySet<string> | null; limit?: number } = {}
): ActivityEvent[] {
  const { allowedProfileIds = null, limit = 50 } = options;
  const pid = (r: Row) => toMaybeString(r.profile_id) ?? "";
  const lower = (r: Row) => String(r.status ?? "").toLowerCase();

  const events: ActivityEvent[] = [
    ...src.profiles.map((p) => ({ at: p.created_at, label: "New account created", pid: p.id })),
    ...src.jobs.map((r) => ({
      at: toMaybeString(r.created_at) ?? "",
      label: "Job created",
      pid: pid(r),
    })),
    ...src.contracts
      .filter((r) => toMaybeString(r.sent_at))
      .map((r) => ({ at: toMaybeString(r.sent_at) ?? "", label: "Contract sent", pid: pid(r) })),
    ...src.contracts
      .filter((r) => toMaybeString(r.signed_at) || lower(r) === "signed")
      .map((r) => ({
        at: toMaybeString(r.signed_at) ?? toMaybeString(r.created_at) ?? "",
        label: "Contract signed",
        pid: pid(r),
      })),
    ...src.estimates
      .filter((r) => toMaybeString(r.sent_at))
      .map((r) => ({ at: toMaybeString(r.sent_at) ?? "", label: "Estimate sent", pid: pid(r) })),
    ...src.estimates
      .filter((r) => toMaybeString(r.accepted_at) || lower(r) === "accepted")
      .map((r) => ({
        at: toMaybeString(r.accepted_at) ?? toMaybeString(r.created_at) ?? "",
        label: "Estimate accepted",
        pid: pid(r),
      })),
    ...src.invoices
      .filter((r) => toMaybeString(r.sent_at))
      .map((r) => ({ at: toMaybeString(r.sent_at) ?? "", label: "Invoice sent", pid: pid(r) })),
    ...src.payments.map((r) => ({
      at: toMaybeString(r.paid_on) ?? toMaybeString(r.created_at) ?? "",
      label: "Payment recorded",
      pid: pid(r),
    })),
  ];

  return events
    .filter((e) => e.at && (!allowedProfileIds || allowedProfileIds.has(e.pid)))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}

export const UNKNOWN_ACTIVITY_OWNER = "unknown user";

/**
 * Owner label for an activity row. Looks the profile up in the full map (never the
 * beta-filtered subset — that caused "unknown user" for every row outside the filter), and
 * only falls back to "unknown user" for genuinely orphaned rows.
 */
export function resolveActivityOwner(
  profileId: string,
  emailByProfileId: ReadonlyMap<string, string>
): string {
  const email = emailByProfileId.get(profileId);
  return email && email !== "-" ? email : UNKNOWN_ACTIVITY_OWNER;
}
