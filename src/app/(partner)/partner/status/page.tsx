import Link from "next/link";
import { redirect } from "next/navigation";
import { JobProofLogo } from "@/components/jobproof-logo";
import { createClient } from "@/lib/supabase/server";
import { getPartnerAccountStatusForCurrentUser } from "@/lib/partners/session";
import { buildPartnerStatusPageView } from "@/lib/partners/partner-status-view";
import { SignInWithAnotherAccountButton } from "@/components/partners/sign-in-with-another-account-button";
import { LogoutButton } from "@/app/(app)/logout-button";

export default async function PartnerStatusPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const signedIn = Boolean(user);
  const signedInEmail = user?.email?.trim().toLowerCase() || null;
  const status = signedIn
    ? await getPartnerAccountStatusForCurrentUser()
    : null;

  if (status?.kind === "active" && status.emailVerified) {
    redirect("/partner");
  }

  const view = buildPartnerStatusPageView({
    signedIn,
    signedInEmail,
    status,
  });

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <Link href="/">
            <JobProofLogo className="h-8 w-auto" />
          </Link>
          {signedIn ? <LogoutButton /> : null}
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-12 sm:py-16">
        {view.showSignedInBanner && view.signedInEmail ? (
          <p className="mb-4 break-words rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
            You are currently signed in as{" "}
            <span className="font-medium text-zinc-900">{view.signedInEmail}</span>.
          </p>
        ) : null}

        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          {view.title}
        </h1>
        <div className="mt-3 space-y-3 text-zinc-600">
          {view.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        {view.showEmailVerificationNotice ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Confirm your email to finish setting up your account. Check your inbox
            for a verification link from JobProof.
          </p>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {view.actions.map((action) => {
            if (action.kind === "sign_in_another_account") {
              return (
                <SignInWithAnotherAccountButton
                  key={action.label}
                  className={actionClassName(action.variant)}
                />
              );
            }
            if (!action.href) return null;
            if (action.variant === "text") {
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="inline-flex items-center justify-center px-1 py-2 text-sm font-medium text-[#2436BB] hover:underline focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 sm:basis-full"
                >
                  {action.label}
                </Link>
              );
            }
            return (
              <Link
                key={action.label}
                href={action.href}
                className={actionClassName(action.variant)}
              >
                {action.label}
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function actionClassName(
  variant: "primary" | "secondary" | "tertiary" | "text"
): string {
  const base =
    "inline-flex w-full items-center justify-center rounded-xl px-5 py-2.5 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 sm:w-auto";
  if (variant === "primary") {
    return `${base} bg-[#2436BB] text-white hover:bg-[#1c2a96] disabled:opacity-60`;
  }
  return `${base} border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50`;
}
