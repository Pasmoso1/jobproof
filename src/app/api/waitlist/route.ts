import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(request: Request) {
  try {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log("SUPABASE_URL present?", Boolean(process.env.SUPABASE_URL));
    console.log("SERVICE_ROLE present?", Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY));

    if (!url || !serviceRoleKey) {
      return NextResponse.json(
        { ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const supabase = createClient(url, serviceRoleKey);
    const resend = new Resend(process.env.RESEND_API_KEY);

    const body = await request.json();
    const { email, trade, city, source, website } = body;

    if (website && String(website).trim()) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "Valid email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { error } = await supabase
      .from("waitlist_signups")
      .insert([
        {
          email: normalizedEmail,
          trade: trade?.trim() ?? null,
          city: city?.trim() ?? null,
          source: source?.trim() ?? null,
        },
      ]);

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
      }
      console.error("SUPABASE_INSERT_ERROR", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const { error: emailError } = await resend.emails.send({
      from: "Job Proof <onboarding@resend.dev>",
      to: normalizedEmail,
      subject: "Job Proof Early Access Request Received",
      text: `
Thanks for requesting early access to Job Proof.

We're building Job Proof to help contractors protect every job with clear contracts, organized documentation, and dispute support.

We'll be in touch as we get closer to launch.

— Job Proof
`,
    });
    if (emailError) {
      console.error("RESEND_EMAIL_ERROR", emailError);
    }

    return NextResponse.json({ ok: true, duplicate: false }, { status: 200 });
  } catch (err) {
    console.error("WAITLIST_ROUTE_ERROR", err);
    return NextResponse.json(
      {
        ok: false,
        error: String((err as { message?: unknown })?.message || err),
      },
      { status: 500 }
    );
  }
}
