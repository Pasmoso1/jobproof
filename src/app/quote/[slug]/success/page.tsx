import Link from "next/link";
import { notFound } from "next/navigation";
import { getContractorByQuoteSlug } from "@/lib/quote-requests/public";
import { QuoteFollowUpFlow } from "./quote-follow-up-flow";

export const dynamic = "force-dynamic";

export default async function QuoteRequestSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ rid?: string; ft?: string }>;
}) {
  const { slug } = await params;
  const { rid, ft } = await searchParams;
  const contractor = await getContractorByQuoteSlug(slug);
  if (!contractor) notFound();

  const phone = contractor.phone.trim();
  const telHref = phone ? `tel:${phone.replace(/\s/g, "")}` : null;
  const showFollowUp = Boolean(rid?.trim() && ft?.trim());

  return (
    <div className="min-h-screen bg-zinc-50 py-8 sm:py-12">
      <div className="mx-auto max-w-xl px-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-zinc-900">Thank you. Your project has been submitted.</h1>

          <ul className="mt-6 space-y-2 text-sm text-zinc-700">
            <li className="flex items-center gap-2">
              <span className="text-emerald-600" aria-hidden="true">
                ✓
              </span>
              Photos received.
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-600" aria-hidden="true">
                ✓
              </span>
              Project details received.
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-600" aria-hidden="true">
                ✓
              </span>
              Contact information received.
            </li>
          </ul>

          <p className="mt-6 text-sm text-zinc-600">
            Most quote requests receive a response within 24 hours.
          </p>

          {showFollowUp ? (
            <QuoteFollowUpFlow slug={slug} requestId={rid!.trim()} token={ft!.trim()} />
          ) : null}

          <div className="mt-8 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <h2 className="text-sm font-semibold text-zinc-900">Need immediate assistance?</h2>
            {phone ? (
              <>
                <p className="mt-2 text-sm text-zinc-700">
                  Call{" "}
                  <a href={telHref!} className="font-semibold text-[#2436BB] hover:underline">
                    {phone}
                  </a>
                </p>
                <p className="mt-2 text-sm text-zinc-600">
                  Since your project information has already been submitted, the contractor will be
                  able to review it before or during your call.
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-zinc-600">
                Contact {contractor.business_name} using the phone number on their website or
                business card.
              </p>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-zinc-500">
            Powered by{" "}
            <Link href="/" className="font-medium text-zinc-700 hover:text-zinc-900">
              JobProof
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
