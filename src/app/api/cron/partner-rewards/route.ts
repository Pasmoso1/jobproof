import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { qualifyEligiblePartnerReferrals } from "@/lib/partners/qualification";
import { verifyQualifiedPartnerReferrals } from "@/lib/partners/payout-verification-runner";

/**
 * Qualify partner referral rewards after 90 days of paid subscription.
 * Schedule POST with `Authorization: Bearer` matching env `CRON_SECRET`.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization")?.trim();
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Service role unavailable" }, { status: 500 });
  }

  const qualifyResult = await qualifyEligiblePartnerReferrals(admin);
  const verifyResult = await verifyQualifiedPartnerReferrals(admin);
  return NextResponse.json({
    ok: true,
    ...qualifyResult,
    verification: verifyResult,
  });
}
