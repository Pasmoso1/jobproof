import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendOpsNotification } from "@/lib/support/ops-notifications";

type AttributionFailureInput = {
  userId: string | null;
  userEmail?: string | null;
  profileId?: string | null;
  referralCode?: string | null;
  source: string;
  stage: string;
  errorMessage: string;
  context?: Record<string, unknown>;
};

function sanitizeContext(
  value: Record<string, unknown> | undefined
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value ?? {})) {
    const lower = key.toLowerCase();
    if (
      lower.includes("token") ||
      lower.includes("secret") ||
      lower.includes("password") ||
      lower.includes("authorization")
    ) {
      continue;
    }
    out[key] = raw ?? null;
  }
  return out;
}

export async function recordPartnerAttributionFailure(
  input: AttributionFailureInput
): Promise<void> {
  const admin = createServiceRoleClient();
  const referralCode = input.referralCode?.trim() || null;
  const userId = input.userId?.trim() || null;
  const profileId = input.profileId?.trim() || null;
  const context = sanitizeContext(input.context);

  if (admin && userId && referralCode) {
    const { data: existing } = await admin
      .from("partner_attribution_failures")
      .select("id")
      .eq("contractor_user_id", userId)
      .eq("referral_code", referralCode)
      .is("resolved_at", null)
      .maybeSingle();

    if (existing?.id) {
      await admin
        .from("partner_attribution_failures")
        .update({
          contractor_profile_id: profileId,
          source: input.source,
          stage: input.stage,
          error_message: input.errorMessage,
          context,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await admin.from("partner_attribution_failures").insert({
        contractor_user_id: userId,
        contractor_profile_id: profileId,
        referral_code: referralCode,
        source: input.source,
        stage: input.stage,
        error_message: input.errorMessage,
        context,
      });
    }
  }

  if (input.userEmail?.trim()) {
    await sendOpsNotification({
      kind: "partner_portal_application",
      subject: "Partner referral attribution failure",
      replyTo: input.userEmail.trim(),
      fields: [
        { label: "User ID", value: userId ?? "—" },
        { label: "Profile ID", value: profileId ?? "—" },
        { label: "Referral code", value: referralCode ?? "—" },
        { label: "Source", value: input.source },
        { label: "Stage", value: input.stage },
      ],
      messageLabel: "Error",
      messageBody: `${input.errorMessage}\n\nContext: ${JSON.stringify(context)}`,
    });
  }
}

export async function resolvePartnerAttributionFailure(input: {
  userId: string | null;
  referralCode?: string | null;
  resolutionNotes?: string;
}): Promise<void> {
  const admin = createServiceRoleClient();
  const userId = input.userId?.trim() || null;
  if (!admin || !userId) return;

  let query = admin
    .from("partner_attribution_failures")
    .update({
      resolved_at: new Date().toISOString(),
      resolution_notes: input.resolutionNotes ?? "Attribution completed",
    })
    .eq("contractor_user_id", userId)
    .is("resolved_at", null);

  if (input.referralCode?.trim()) {
    query = query.eq("referral_code", input.referralCode.trim());
  }

  await query;
}
