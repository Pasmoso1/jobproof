"use client";

import Link from "next/link";
import {
  PARTNER_EXISTING_ACCOUNT_FORGOT_PASSWORD_HREF,
  PARTNER_EXISTING_ACCOUNT_FORGOT_PASSWORD_LABEL,
  PARTNER_EXISTING_ACCOUNT_PRIMARY_CTA,
  PARTNER_EXISTING_ACCOUNT_SECONDARY_CTA,
  PARTNER_EXISTING_ACCOUNT_TITLE,
  partnerExistingAccountBody,
  type PartnerExistingAccountContinueKind,
} from "@/lib/partners/apply-existing-account";

export function ExistingAccountContinuePanel({
  kind,
  signInHref,
  onSignIn,
  onUseDifferentEmail,
}: {
  kind: PartnerExistingAccountContinueKind;
  /** Prefer href navigation so drafts are already persisted before leave. */
  signInHref: string;
  onSignIn?: () => void;
  onUseDifferentEmail: () => void;
}) {
  return (
    <div
      className="rounded-xl border border-[#2436BB]/20 bg-[#2436BB]/5 px-4 py-4 text-sm text-zinc-900 sm:px-5 sm:py-5"
      role="status"
    >
      <p className="text-base font-semibold text-zinc-950">
        {PARTNER_EXISTING_ACCOUNT_TITLE}
      </p>
      <p className="mt-2 leading-relaxed text-zinc-700">
        {partnerExistingAccountBody(kind)}
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Link
          href={signInHref}
          onClick={onSignIn}
          className="inline-flex items-center justify-center rounded-xl bg-[#2436BB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2"
        >
          {PARTNER_EXISTING_ACCOUNT_PRIMARY_CTA}
        </Link>
        <button
          type="button"
          onClick={onUseDifferentEmail}
          className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2"
        >
          {PARTNER_EXISTING_ACCOUNT_SECONDARY_CTA}
        </button>
      </div>
      <p className="mt-3 text-sm text-zinc-600">
        <Link
          href={PARTNER_EXISTING_ACCOUNT_FORGOT_PASSWORD_HREF}
          className="font-medium text-[#2436BB] hover:underline"
        >
          {PARTNER_EXISTING_ACCOUNT_FORGOT_PASSWORD_LABEL}
        </Link>
      </p>
    </div>
  );
}
