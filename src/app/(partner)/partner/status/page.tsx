import Link from "next/link";
import { redirect } from "next/navigation";
import { JobProofLogo } from "@/components/jobproof-logo";
import { createClient } from "@/lib/supabase/server";
import { getPartnerAccountStatusForCurrentUser } from "@/lib/partners/session";
import { LogoutButton } from "@/app/(app)/logout-button";

export default async function PartnerStatusPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/partner/status");
  }

  const status = await getPartnerAccountStatusForCurrentUser();

  if (status.kind === "active" && status.emailVerified) {
    redirect("/partner");
  }

  const content = statusContent(status);

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link href="/">
            <JobProofLogo className="h-8 w-auto" />
          </Link>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-2xl font-bold text-zinc-900">{content.title}</h1>
        <p className="mt-3 text-zinc-600">{content.body}</p>
        {!status.emailVerified && status.kind !== "none" ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Confirm your email to finish setting up your account. Check your inbox for
            a verification link from JobProof.
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-3">
          {content.primaryHref ? (
            <Link
              href={content.primaryHref}
              className="rounded-xl bg-[#2436BB] px-5 py-2.5 text-sm font-semibold text-white"
            >
              {content.primaryLabel}
            </Link>
          ) : null}
          <Link
            href="/dashboard"
            className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900"
          >
            Contractor dashboard
          </Link>
          <Link
            href="/partners"
            className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900"
          >
            Partner Program
          </Link>
        </div>
      </main>
    </div>
  );
}

function statusContent(
  status: Awaited<ReturnType<typeof getPartnerAccountStatusForCurrentUser>>
): {
  title: string;
  body: string;
  primaryHref?: string;
  primaryLabel?: string;
} {
  if (status.kind === "active" && !status.emailVerified) {
    return {
      title: "Approved — confirm your email",
      body: "Your partner application is approved. Confirm your email address to open the Partner Portal.",
      primaryHref: "/partner",
      primaryLabel: "Try Partner Portal",
    };
  }
  if (status.kind === "partner_inactive") {
    if (status.status === "suspended") {
      return {
        title: "Partner account suspended",
        body: "Your partner account is suspended. Contact JobProof support if you believe this is a mistake.",
      };
    }
    return {
      title: "Partner account inactive",
      body: "Your partner account is not currently active. Contact JobProof support for help.",
    };
  }
  if (status.kind === "application") {
    if (status.status === "submitted") {
      return {
        title: "Application submitted",
        body: `Thanks${status.organizationName ? ` — we received your application for ${status.organizationName}` : ""}. Our team will review it and email you when there is an update.`,
      };
    }
    if (status.status === "under_review") {
      return {
        title: "Application under review",
        body: "Your partner application is under review. We’ll email you when a decision is ready.",
      };
    }
    if (status.status === "declined") {
      return {
        title: "Application declined",
        body: "We’re not able to approve your partner application at this time. You can still use JobProof as a contractor if you have an account.",
        primaryHref: "/partners",
        primaryLabel: "Partner Program",
      };
    }
    return {
      title: "Approved — portal available",
      body: "Your application was approved. Open the Partner Portal to continue.",
      primaryHref: "/partner",
      primaryLabel: "Open Partner Portal",
    };
  }
  return {
    title: "No partner application on this account",
    body: "This account is not linked to a JobProof partner application. Apply to the Partner Program or sign in with the username you chose when applying.",
    primaryHref: "/partners/apply",
    primaryLabel: "Apply now",
  };
}
