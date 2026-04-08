import { NextResponse } from "next/server";
import { runInvoiceReminderAutomation } from "@/lib/invoice-reminder-cron";

/**
 * Server-side entry point for automated invoice reminders (service role + Resend).
 * Operators: schedule POST with `Authorization: Bearer` matching env `CRON_SECRET`.
 * See README “Automated invoice reminders (operators)” for deployment notes.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization")?.trim();
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runInvoiceReminderAutomation();
  return NextResponse.json(result);
}
