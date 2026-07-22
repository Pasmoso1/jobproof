import Link from "next/link";
import { requireAdminUserOrRedirectLogin } from "@/lib/admin-auth";
import { AdminNotAuthorized } from "@/app/admin/NotAuthorized";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  FOUNDING_PARTNER_LIMIT,
  partnerTypeLabel,
  rewardStatusLabel,
  type PartnerLevel,
  type PartnerRewardStatus,
} from "@/lib/partners/constants";
import { AdminPartnersClient } from "./admin-partners-client";

export default async function AdminPartnersPage() {
  const auth = await requireAdminUserOrRedirectLogin();
  if (!auth.ok) return <AdminNotAuthorized userEmail={auth.userEmail ?? ""} />;

  const admin = createServiceRoleClient();
  if (!admin) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <p className="text-red-700">Service role unavailable.</p>
      </div>
    );
  }

  const [
    { data: applications },
    { data: partners },
    { data: referrals },
    { count: foundingCount },
  ] = await Promise.all([
    admin
      .from("partner_applications")
      .select("*")
      .order("submitted_at", { ascending: false })
      .limit(100),
    admin.from("partners").select("*").order("created_at", { ascending: false }).limit(100),
    admin
      .from("partner_referrals")
      .select(
        "id, partner_id, contractor_business_name, signup_date, subscription_started_at, qualification_date, reward_amount, reward_status, reward_paid_at, partners(organization_name, referral_code)"
      )
      .order("signup_date", { ascending: false })
      .limit(200),
    admin
      .from("partners")
      .select("id", { count: "exact", head: true })
      .eq("partner_level", "founding")
      .neq("status", "declined"),
  ]);

  const applicationRows = await Promise.all(
    (applications ?? []).map(async (a) => {
      let emailVerified = Boolean(a.email_confirmed_at);
      if (a.auth_user_id) {
        try {
          const { data: userData } = await admin.auth.admin.getUserById(
            String(a.auth_user_id)
          );
          if (userData.user?.email_confirmed_at) {
            emailVerified = true;
            if (!a.email_confirmed_at) {
              await admin
                .from("partner_applications")
                .update({
                  email_confirmed_at: userData.user.email_confirmed_at,
                })
                .eq("id", a.id);
            }
          }
        } catch {
          // Ignore Auth lookup failures for admin list rendering.
        }
      }
      return {
        id: a.id,
        organization_name: a.organization_name,
        contact_name: a.contact_name,
        email: a.email,
        phone: a.phone,
        website: a.website,
        partner_type: partnerTypeLabel(a.partner_type),
        estimated_audience: a.estimated_audience,
        promotion_plan: a.promotion_plan,
        reason: a.reason,
        status: a.status,
        submitted_at: a.submitted_at,
        reviewed_at: a.reviewed_at,
        reviewed_by: a.reviewed_by,
        decline_reason: a.decline_reason,
        agreement_version: a.agreement_version,
        agreement_accepted_at: a.agreement_accepted_at,
        created_partner_id: a.created_partner_id,
        username: a.username ?? null,
        auth_user_id: a.auth_user_id ?? null,
        email_confirmed_at: a.email_confirmed_at ?? null,
        email_verified: emailVerified,
        auth_account_linked: Boolean(a.auth_user_id),
        legacy_account: !a.auth_user_id || !a.username,
      };
    })
  );

  const pendingApps = applicationRows.filter((a) =>
    ["submitted", "under_review"].includes(a.status)
  );
  const qualified = (referrals ?? []).filter((r) => r.reward_status === "qualified");
  const approvedRewards = (referrals ?? []).filter((r) => r.reward_status === "approved");
  const paidRewards = (referrals ?? []).filter((r) => r.reward_status === "paid");
  const foundingSlotsAvailable = (foundingCount ?? 0) < FOUNDING_PARTNER_LIMIT;

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
            ← Admin
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-zinc-900">Partner Program</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Applications, partners, referrals, and manual payouts. Founding slots used:{" "}
            {foundingCount ?? 0} of {FOUNDING_PARTNER_LIMIT}.{" "}
            {foundingSlotsAvailable
              ? "Founding positions remain available."
              : "Founding positions are filled."}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Pending applications" value={String(pendingApps.length)} />
        <Card label="Active partners" value={String((partners ?? []).filter((p) => p.status === "active").length)} />
        <Card label="Qualified rewards" value={String(qualified.length)} />
        <Card label="Approved / paid" value={`${approvedRewards.length} / ${paidRewards.length}`} />
      </div>

      <AdminPartnersClient
        applications={applicationRows}
        partners={(partners ?? []).map((p) => ({
          id: p.id,
          organization_name: p.organization_name,
          contact_name: p.contact_name,
          email: p.email,
          partner_type: partnerTypeLabel(p.partner_type),
          partner_level: p.partner_level as PartnerLevel,
          status: p.status,
          referral_code: p.referral_code,
          created_at: p.created_at,
          agreement_version: p.agreement_version,
          agreement_accepted_at: p.agreement_accepted_at,
          username: p.username ?? null,
          auth_user_id: p.auth_user_id ?? null,
          legacy_account: !p.auth_user_id || !p.username,
        }))}
        referrals={(referrals ?? []).map((r) => {
          const partnersEmbed = r.partners as
            | { organization_name?: string; referral_code?: string }
            | { organization_name?: string; referral_code?: string }[]
            | null;
          const pe = Array.isArray(partnersEmbed) ? partnersEmbed[0] : partnersEmbed;
          return {
            id: r.id,
            partner_name: pe?.organization_name ?? "—",
            referral_code: pe?.referral_code ?? "—",
            contractor_business_name: r.contractor_business_name,
            signup_date: r.signup_date,
            subscription_started_at: r.subscription_started_at,
            qualification_date: r.qualification_date,
            reward_amount: Number(r.reward_amount),
            reward_status: r.reward_status as PartnerRewardStatus,
            reward_paid_at: r.reward_paid_at,
            reward_status_label: rewardStatusLabel(r.reward_status as PartnerRewardStatus),
            level_label: "",
          };
        })}
      />
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-zinc-900">{value}</p>
    </div>
  );
}
