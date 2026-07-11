import { NextResponse } from "next/server";
import { runTrialReminderAutomation } from "@/lib/trial-reminder-cron";

/**
 * JobProof-managed trial reminder emails (day 3/7/12/ended) + expire status.
 * Schedule POST with `Authorization: Bearer` matching env `CRON_SECRET`.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization")?.trim();
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runTrialReminderAutomation();
  return NextResponse.json(result);
}
