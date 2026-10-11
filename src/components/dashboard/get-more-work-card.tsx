"use client";

import Link from "next/link";
import { useId } from "react";
import {
  COMPLETE_BUSINESS_PROFILE_PATH,
  QUOTE_REQUEST_SETTINGS_PATH,
} from "@/lib/quote-link-share";
import {
  SEND_QUOTE_REQUEST_DESCRIPTION,
  SEND_QUOTE_REQUEST_LABEL,
  SendQuoteRequestForm,
  primaryButtonClassName,
} from "@/components/send-quote-request";

export function GetMoreWorkCard({
  quoteUrl,
  businessName,
  variant,
  profileReady,
}: {
  quoteUrl: string | null;
  businessName: string | null;
  variant: "prominent" | "compact";
  profileReady: boolean;
}) {
  const compact = variant === "compact";
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className={`rounded-xl border border-[#2436BB]/25 bg-white shadow-sm ${compact ? "p-4 sm:p-5" : "p-5 sm:p-8"}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[#2436BB]">
        Get more work
      </p>
      <h2
        id={headingId}
        className={`mt-1 font-bold tracking-tight text-zinc-900 ${compact ? "text-lg sm:text-xl" : "text-2xl sm:text-3xl"}`}
      >
        {SEND_QUOTE_REQUEST_LABEL}
      </h2>
      <p className={`mt-2 max-w-xl text-zinc-600 ${compact ? "text-sm" : "text-sm sm:text-base"}`}>
        {profileReady
          ? SEND_QUOTE_REQUEST_DESCRIPTION
          : "Complete your business profile so customers can tell you what they need and request a quote."}
      </p>

      {!profileReady ? (
        <div className={compact ? "mt-4" : "mt-4 sm:mt-6"}>
          <Link href={COMPLETE_BUSINESS_PROFILE_PATH} className={primaryButtonClassName}>
            Complete your profile
          </Link>
        </div>
      ) : quoteUrl ? (
        <div className={compact ? "mt-4" : "mt-4 sm:mt-6"}>
          <SendQuoteRequestForm
            quoteUrl={quoteUrl}
            businessName={businessName}
            sourceLocation="dashboard"
            layout="inline"
          />
        </div>
      ) : (
        <div className={compact ? "mt-4" : "mt-4 sm:mt-6"}>
          <Link href={QUOTE_REQUEST_SETTINGS_PATH} className={primaryButtonClassName}>
            Set up your quote link
          </Link>
          <p className="mt-2 text-xs text-zinc-500">
            Choose your quote page address once, then send it to customers in seconds.
          </p>
        </div>
      )}
    </section>
  );
}
