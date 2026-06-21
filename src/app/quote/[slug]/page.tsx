import { notFound } from "next/navigation";
import { getContractorByQuoteSlug } from "@/lib/quote-requests/public";
import { QuoteRequestForm } from "./quote-request-form";

export const dynamic = "force-dynamic";

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const contractor = await getContractorByQuoteSlug(slug);
  if (!contractor) notFound();

  return (
    <div className="min-h-screen bg-zinc-50 py-8 sm:py-12">
      <div className="mx-auto max-w-xl px-4">
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
            <p className="text-sm font-medium text-zinc-900">{contractor.business_name}</p>
            {contractor.trade_label ? (
              <p className="mt-1 text-sm text-zinc-600">{contractor.trade_label}</p>
            ) : null}
            <h1 className="mt-2 text-2xl font-bold text-zinc-900">Request a Quote</h1>
            <p className="mt-2 text-sm text-zinc-600">
              Upload photos and answer a few questions.
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Most quote requests receive a response within 24 hours.
            </p>
          </div>

          <QuoteRequestForm slug={contractor.quote_slug} contractorPhone={contractor.phone} />
        </div>
      </div>
    </div>
  );
}
