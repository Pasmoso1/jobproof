import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getContractorByQuoteSlug } from "@/lib/quote-requests/public";
import { buildQuoteRequestPageMetadata } from "@/lib/quote-requests/link-preview";
import {
  isQuoteFormPreviewMode,
  QUOTE_FORM_PREVIEW_BANNER,
} from "@/lib/quote-requests/preview-mode";
import { resolveAppUrl } from "@/lib/stripe";
import { QuoteRequestForm } from "./quote-request-form";

export const dynamic = "force-dynamic";

const loadContractor = cache(getContractorByQuoteSlug);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return buildQuoteRequestPageMetadata(await loadContractor(slug), resolveAppUrl());
}

function PoweredByJobProof() {
  return (
    <p className="mt-6 text-center text-xs text-zinc-500">
      Powered by{" "}
      <Link href="/" className="font-medium text-zinc-700 hover:text-zinc-900">
        JobProof
      </Link>
    </p>
  );
}

export default async function PublicQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const contractor = await loadContractor(slug);
  if (!contractor) notFound();
  const previewMode = isQuoteFormPreviewMode(sp);

  if (!contractor.quote_ready) {
    return (
      <div className="min-h-screen bg-zinc-50 py-8 sm:py-12">
        <div className="mx-auto max-w-xl px-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm sm:p-8">
            <h1 className="text-xl font-bold text-zinc-900">
              Online quote requests aren&apos;t available yet
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              This contractor is still setting up their quote request page. Please check back soon
              or contact them directly.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-8 sm:py-12">
      <div className="mx-auto max-w-xl px-4">
        {previewMode ? (
          <div
            role="status"
            className="mb-4 rounded-lg border border-[#2436BB]/25 bg-[#2436BB]/5 px-4 py-3 text-sm text-zinc-800"
          >
            <p className="font-semibold text-zinc-900">Contractor preview</p>
            <p className="mt-1 text-zinc-700">{QUOTE_FORM_PREVIEW_BANNER}</p>
          </div>
        ) : null}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 text-center">
            {contractor.quote_logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={contractor.quote_logo_url}
                alt=""
                className="mx-auto mb-4 h-16 w-auto max-w-[200px] object-contain"
              />
            ) : null}
            <p className="text-lg font-semibold text-zinc-900 break-words">
              {contractor.business_name}
            </p>
            {contractor.trade_label ? (
              <p className="mt-0.5 text-sm text-zinc-600">{contractor.trade_label}</p>
            ) : null}
            <h1 className="mt-3 text-2xl font-bold text-zinc-900">Request a Quote</h1>
            <p className="mt-2 text-sm text-zinc-600">
              Upload photos and answer a few questions.
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Most quote requests receive a response within 24 hours.
            </p>
          </div>

          <QuoteRequestForm
            slug={contractor.quote_slug}
            contractorPhone={contractor.phone}
            previewMode={previewMode}
          />
        </div>
        <PoweredByJobProof />
      </div>
    </div>
  );
}
