import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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
      from: "Job Proof <hello@jobproof.ca>",
      to: normalizedEmail,
      reply_to: "jeffrey@jobproof.ca",
      subject: "You're on the Job Proof early access list",
      html: `
    <div style="font-family: Arial, sans-serif; line-height:1.5;">
      <h2>You're on the list.</h2>

      <p>Thanks for requesting early access to <strong>Job Proof</strong>.</p>

      <p>
      We're building Job Proof with real contractors across Ontario to help
      create clear contracts, document jobs properly, and stay protected
      when problems happen.
      </p>

      <p>
      You'll be among the first contractors notified when early access opens.
      </p>

      <p>
      — Job Proof
      </p>
    </div>
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
