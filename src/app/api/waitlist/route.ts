import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  readFirstTouchFromCookieHeader,
  type FirstTouchAttribution,
} from "@/lib/attribution-first-touch";

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
    const {
      email,
      trade,
      city,
      province,
      source,
      website,
      heard_about_source,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      referrer,
      landing_page,
      first_seen_at,
    } = body;

    if (website && String(website).trim()) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "Valid email is required" },
        { status: 400 }
      );
    }

    const provinceStr =
      typeof province === "string" ? province.trim() : String(province ?? "").trim();
    if (!provinceStr) {
      return NextResponse.json(
        { ok: false, error: "Province is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cookieAttribution = readFirstTouchFromCookieHeader(request.headers.get("cookie"));
    const payloadAttribution: Partial<FirstTouchAttribution> = {
      utm_source: typeof utm_source === "string" ? utm_source : null,
      utm_medium: typeof utm_medium === "string" ? utm_medium : null,
      utm_campaign: typeof utm_campaign === "string" ? utm_campaign : null,
      utm_content: typeof utm_content === "string" ? utm_content : null,
      utm_term: typeof utm_term === "string" ? utm_term : null,
      referrer: typeof referrer === "string" ? referrer : null,
      landing_page: typeof landing_page === "string" ? landing_page : null,
      first_seen_at: typeof first_seen_at === "string" ? first_seen_at : undefined,
      heard_about_source:
        typeof heard_about_source === "string" ? heard_about_source : null,
    };

    const mergedAttribution = {
      utm_source:
        payloadAttribution.utm_source ?? cookieAttribution?.utm_source ?? null,
      utm_medium:
        payloadAttribution.utm_medium ?? cookieAttribution?.utm_medium ?? null,
      utm_campaign:
        payloadAttribution.utm_campaign ?? cookieAttribution?.utm_campaign ?? null,
      utm_content:
        payloadAttribution.utm_content ?? cookieAttribution?.utm_content ?? null,
      utm_term: payloadAttribution.utm_term ?? cookieAttribution?.utm_term ?? null,
      referrer: payloadAttribution.referrer ?? cookieAttribution?.referrer ?? null,
      landing_page:
        payloadAttribution.landing_page ?? cookieAttribution?.landing_page ?? null,
      first_seen_at:
        payloadAttribution.first_seen_at ?? cookieAttribution?.first_seen_at ?? null,
      heard_about_source:
        payloadAttribution.heard_about_source ??
        cookieAttribution?.heard_about_source ??
        null,
    };

    const { error } = await supabase
      .from("waitlist_signups")
      .insert([
        {
          email: normalizedEmail,
          trade: trade?.trim() ?? null,
          city: city?.trim() ?? null,
          province: provinceStr,
          source: source?.trim() ?? null,
          heard_about_source: mergedAttribution.heard_about_source,
          utm_source: mergedAttribution.utm_source,
          utm_medium: mergedAttribution.utm_medium,
          utm_campaign: mergedAttribution.utm_campaign,
          utm_content: mergedAttribution.utm_content,
          utm_term: mergedAttribution.utm_term,
          referrer: mergedAttribution.referrer,
          landing_page: mergedAttribution.landing_page,
          first_seen_at: mergedAttribution.first_seen_at,
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
      replyTo: "jeffrey@jobproof.ca",
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
