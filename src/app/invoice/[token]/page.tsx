import type { Metadata } from "next";
import { after } from "next/server";
import { PublicInvoiceToolbar } from "@/components/public-invoice-toolbar";
import {
  fetchPublicInvoicePageData,
  isValidPublicInvoiceToken,
  markPublicInvoiceViewedOnce,
} from "@/lib/invoice-public";

function money(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function NotFoundMessage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-16">
      <div className="max-w-md rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-900">Invoice not found</h1>
        <p className="mt-2 text-sm text-zinc-600">
          This link may be incorrect or no longer valid. If you need a copy of your invoice,
          please contact your contractor.
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
  if (!isValidPublicInvoiceToken(token)) {
    return { title: "Invoice" };
  }
  const data = await fetchPublicInvoicePageData(token);
  if (!data) return { title: "Invoice" };
  return {
    title: `${data.invoiceNumberLabel} · ${data.contractor.businessName}`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isValidPublicInvoiceToken(token)) {
    return <NotFoundMessage />;
  }

  const data = await fetchPublicInvoicePageData(token);
  if (!data) {
    return <NotFoundMessage />;
  }

  after(() => {
    void markPublicInvoiceViewedOnce(token).catch(() => {});
  });

  const { contractor: c, customer: cu } = data;
  const paymentContactLines =
    data.eTransferEmail != null && data.eTransferEmail !== ""
      ? data.paymentContactLines.filter(
          (l) => !l.toLowerCase().startsWith("e-transfer:")
        )
      : data.paymentContactLines;

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
                Invoice
              </p>
              <h1 className="text-xl font-bold text-zinc-900 sm:text-2xl">
                {data.invoiceNumberLabel}
              </h1>
              <p className="text-sm text-zinc-600">{data.jobTitle}</p>
            </div>
          </div>
          <PublicInvoiceToolbar token={data.token} hasPdf={data.hasPdf} />
        </header>

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
              <h2 className="text-xs font-bold uppercase tracking-wide text-[#2436BB]">
                Bill to
              </h2>
              <div className="mt-2 space-y-1 text-sm text-zinc-800">
                <p className="font-semibold">{cu.name}</p>
                {cu.email ? <p>Email: {cu.email}</p> : null}
                {cu.phone ? <p>Phone: {cu.phone}</p> : null}
                {cu.serviceAddressLines.some((l) => l.trim()) ? (
                  <>
                    <p className="mt-2 font-medium text-zinc-700">Service address</p>
                    {cu.serviceAddressLines.filter((l) => l.trim()).map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </>
                ) : null}
              </div>
            </section>
          </div>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-[#2436BB]">
              Details
            </h2>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-4 sm:block">
                <dt className="text-zinc-500">Issue date</dt>
                <dd className="font-medium text-zinc-900">{data.issueDateLabel}</dd>
              </div>
              <div className="flex justify-between gap-4 sm:block">
                <dt className="text-zinc-500">Due date</dt>
                <dd className="font-medium text-zinc-900">
                  {data.dueDateLabel ?? "—"}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-[#2436BB]">
              Line items
            </h2>
            <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200">
              <table className="w-full min-w-[280px] text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-zinc-700">Description</th>
                    <th className="px-3 py-2 text-right font-semibold text-zinc-700">Qty</th>
                    <th className="px-3 py-2 text-right font-semibold text-zinc-700">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lineItems.map((row, i) => (
                    <tr key={i} className="border-b border-zinc-100 last:border-0">
                      <td className="px-3 py-2 text-zinc-800">{row.description}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-700">
                        {row.quantity}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium text-zinc-900">
                        ${money(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-600">Subtotal</dt>
                <dd className="tabular-nums font-medium">${money(data.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-600">Tax ({data.taxRateLabel})</dt>
                <dd className="tabular-nums font-medium">${money(data.taxAmount)}</dd>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold">
                <dt className="text-zinc-900">Total</dt>
                <dd className="tabular-nums text-zinc-900">${money(data.total)}</dd>
              </div>
              <div className="flex justify-between text-zinc-600">
                <dt>Deposit received</dt>
                <dd className="tabular-nums">${money(data.depositCredited)}</dd>
              </div>
              {data.amountPaidTotal > 0.0001 && (
                <div className="flex justify-between text-zinc-600">
                  <dt>Payments received</dt>
                  <dd className="tabular-nums">${money(data.amountPaidTotal)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-bold text-[#2436BB]">
                <dt>Remaining balance</dt>
                <dd className="tabular-nums">${money(data.balanceDue)}</dd>
              </div>
            </dl>
            <p className="mt-3 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-600">
              Already paid? Please contact the contractor if your payment is not yet reflected here.
            </p>
          </section>

          {data.notes ? (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wide text-[#2436BB]">
                Notes
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{data.notes}</p>
            </section>
          ) : null}

          <section className="rounded-lg border border-amber-200 bg-amber-50/80 p-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-amber-900">
              How to pay
            </h2>
            {data.eTransferEmail ? (
              <p className="mt-2 text-sm text-amber-950">
                <span className="font-semibold">Interac e-Transfer: </span>
                <span className="break-all">{data.eTransferEmail}</span>
              </p>
            ) : null}
            <div className="mt-3 whitespace-pre-wrap text-sm text-amber-950">
              {data.paymentInstructions}
            </div>
            {paymentContactLines.length > 0 ? (
              <div className="mt-3 text-sm text-amber-950">
                <p className="font-semibold">Payment contact</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {paymentContactLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="mt-4 text-xs text-amber-900/90">
              Please contact the contractor to arrange payment if you are unsure how to proceed.
            </p>
          </section>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500 print:hidden">
          Secured by JobProof · This page is for your records only.
        </p>
      </div>
    </div>
  );
}
