import type { Metadata } from "next";
import { after } from "next/server";
import { PublicEstimateToolbar } from "@/components/public-estimate-toolbar";
import {
  fetchPublicEstimatePageData,
  isValidPublicEstimateToken,
  markPublicEstimateViewedOnce,
} from "@/lib/estimate-public";
import { submitAcceptEstimate, submitDeclineEstimate } from "./public-estimate-actions";

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function NotFoundMessage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-16">
      <div className="max-w-md rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-900">Estimate not found</h1>
        <p className="mt-2 text-sm text-zinc-600">
          This link may be incorrect or no longer valid. Contact your contractor for an updated
          estimate.
        </p>
      </div>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  if (!isValidPublicEstimateToken(token)) {
    return { title: "Estimate" };
  }
  const data = await fetchPublicEstimatePageData(token);
  if (!data) return { title: "Estimate" };
  return {
    title: `${data.estimateNumberLabel} · ${data.contractor.businessName}`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicEstimatePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const sp = searchParams ? await searchParams : {};
  const outcome = typeof sp.outcome === "string" ? sp.outcome : Array.isArray(sp.outcome) ? sp.outcome[0] : undefined;
  const reason = typeof sp.reason === "string" ? sp.reason : Array.isArray(sp.reason) ? sp.reason[0] : undefined;

  if (!isValidPublicEstimateToken(token)) {
    return <NotFoundMessage />;
  }

  const data = await fetchPublicEstimatePageData(token);
  if (!data) {
    return <NotFoundMessage />;
  }

  after(() => {
    void markPublicEstimateViewedOnce(token).catch(() => {});
  });

  const { contractor: c, customer: cu } = data;

  if (outcome === "accepted") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-16">
        <div className="max-w-md rounded-xl border border-emerald-200 bg-emerald-50/80 p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-emerald-950">Thank you — estimate accepted</h1>
          <p className="mt-3 text-sm text-emerald-900">
            Your contractor has been notified. They&apos;ll follow up with next steps for your
            project.
          </p>
        </div>
      </div>
    );
  }

  if (outcome === "declined") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-16">
        <div className="max-w-md rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-zinc-900">Estimate declined</h1>
          <p className="mt-3 text-sm text-zinc-600">
            Your response has been recorded. If you declined by mistake, please contact your
            contractor.
          </p>
        </div>
      </div>
    );
  }

  if (outcome === "error") {
    const copy =
      reason === "expired"
        ? "This estimate is no longer open for acceptance (it may have expired)."
        : reason === "already_answered"
          ? "This estimate was already accepted or declined."
          : "We could not record your response. Please try again or contact your contractor.";
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-16">
        <div className="max-w-md rounded-xl border border-amber-200 bg-amber-50/90 p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-amber-950">Something went wrong</h1>
          <p className="mt-3 text-sm text-amber-950">{copy}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 print:bg-white">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 print:max-w-none print:py-4">
        <header className="mb-6 flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-start sm:justify-between print:border-zinc-300">
          <div className="flex items-center gap-3">
            <img
              src="/jobproof-logo.png"
              alt="Job Proof"
              className="h-8 w-auto print:hidden"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#2436BB] print:text-zinc-600">
                Estimate (quote)
              </p>
              <h1 className="text-xl font-bold text-zinc-900 sm:text-2xl">
                {data.estimateNumberLabel}
              </h1>
              <p className="text-sm text-zinc-600">{data.title}</p>
            </div>
          </div>
          <PublicEstimateToolbar token={data.token} hasPdf={data.hasPdf} />
        </header>

        {data.displayStatus === "expired" && (
          <div
            className="mb-6 rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-4 text-sm text-zinc-800 sm:px-5"
            role="status"
          >
            <p className="font-semibold text-zinc-900">
              This estimate has expired and is no longer open for acceptance.
            </p>
            <p className="mt-2 text-zinc-700">
              Please contact the contractor if you would like an updated estimate.
            </p>
          </div>
        )}

        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
          <p className="font-semibold">This is an estimate, not a signed contract.</p>
          <p className="mt-1">
            Pricing and scope are provided for planning purposes. No work is authorized until you
            and your contractor agree separately (for example through a written contract).
          </p>
        </div>

        <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8 print:border-0 print:shadow-none">
          <div className="grid gap-6 sm:grid-cols-2">
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wide text-[#2436BB]">
                Contractor
              </h2>
              <div className="mt-2 space-y-1 text-sm text-zinc-800">
                <p className="font-semibold">{c.businessName}</p>
                {c.contactName ? <p>Contact: {c.contactName}</p> : null}
                {c.phone ? <p>Phone: {c.phone}</p> : null}
                {c.email ? <p>Email: {c.email}</p> : null}
                {c.addressLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </section>
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wide text-[#2436BB]">Customer</h2>
              <div className="mt-2 space-y-1 text-sm text-zinc-800">
                <p className="font-semibold">{cu.name}</p>
                {cu.email ? <p>Email: {cu.email}</p> : null}
                {cu.phone ? <p>Phone: {cu.phone}</p> : null}
              </div>
            </section>
          </div>

          {data.propertyAddressLines.some((l) => l.trim()) ? (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wide text-[#2436BB]">
                Property / work location
              </h2>
              <div className="mt-2 text-sm text-zinc-800">
                {data.propertyAddressLines.filter((l) => l.trim()).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-[#2436BB]">Details</h2>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-4 sm:block">
                <dt className="text-zinc-500">Estimate date</dt>
                <dd className="font-medium text-zinc-900">{data.issueDateLabel}</dd>
              </div>
              <div className="flex justify-between gap-4 sm:block">
                <dt className="text-zinc-500">Valid until</dt>
                <dd className="font-medium text-zinc-900">{data.expiryDateLabel ?? "—"}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-[#2436BB]">Scope of work</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">{data.scopeOfWork || "—"}</p>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-[#2436BB]">Pricing</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-600">Subtotal (before tax)</dt>
                <dd className="tabular-nums font-medium">${money(data.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-600">Tax ({data.taxRateLabel})</dt>
                <dd className="tabular-nums font-medium">${money(data.taxAmount)}</dd>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold">
                <dt className="text-zinc-900">Total (including tax)</dt>
                <dd className="tabular-nums text-zinc-900">${money(data.total)}</dd>
              </div>
              {data.depositAmount != null ? (
                <div className="flex justify-between text-zinc-600">
                  <dt>Suggested deposit</dt>
                  <dd className="tabular-nums">${money(data.depositAmount)}</dd>
                </div>
              ) : null}
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-zinc-500 sm:text-sm">
              The total includes sales tax (subtotal plus tax). Your contractor uses the same basis
              when preparing your job and written contract.
            </p>
          </section>

          {data.notes ? (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wide text-[#2436BB]">Notes</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{data.notes}</p>
            </section>
          ) : null}

          {data.canRespond ? (
            <section className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-zinc-900">Your response</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Accept if you want to proceed on this basis, or decline if it is not a fit.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <form action={submitAcceptEstimate.bind(null, data.token)}>
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 sm:w-auto"
                  >
                    Accept estimate
                  </button>
                </form>
                <form action={submitDeclineEstimate.bind(null, data.token)}>
                  <button
                    type="submit"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 sm:w-auto"
                  >
                    Decline estimate
                  </button>
                </form>
              </div>
            </section>
          ) : (
            <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              {data.displayStatus === "expired" ? (
                <div>
                  <p className="font-semibold text-zinc-900">
                    This estimate has expired and is no longer open for acceptance.
                  </p>
                  <p className="mt-2 text-zinc-700">
                    Please contact the contractor if you would like an updated estimate.
                  </p>
                </div>
              ) : data.dbStatus === "accepted" ? (
                <p>This estimate was already accepted. Thank you.</p>
              ) : data.dbStatus === "declined" ? (
                <p>This estimate was declined. Contact your contractor if you have questions.</p>
              ) : (
                <p>This estimate is not open for responses right now.</p>
              )}
            </section>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500 print:hidden">
          Secured by JobProof · This page is for your records only.
        </p>
      </div>
    </div>
  );
}
