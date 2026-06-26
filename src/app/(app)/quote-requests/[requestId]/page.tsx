import Link from "next/link";
import { notFound } from "next/navigation";
import {
  QuoteRequestNeedsResponseBanner,
  QuoteRequestOverdueBanner,
} from "@/components/quote-request-response";
import {
  QuoteRequestNewUrgentBanner,
  QuoteRequestUrgentDetailBadge,
  QuoteRequestUrgentListBadge,
} from "@/components/quote-request-urgency";
import { formatDateTimeEastern } from "@/lib/datetime-eastern";
import { quoteRequestStatusLabel } from "@/lib/quote-requests/constants";
import { formatFollowUpAnswerDisplay } from "@/lib/quote-requests/follow-up-types";
import { getQuoteRequestDetail } from "../quote-request-actions";
import { QuoteRequestActionButtons } from "./quote-request-action-buttons";

export const dynamic = "force-dynamic";

export default async function QuoteRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const request = await getQuoteRequestDetail(requestId);
  if (!request) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <QuoteRequestOverdueBanner status={request.status} submittedAt={request.submitted_at} />
      <QuoteRequestNeedsResponseBanner status={request.status} submittedAt={request.submitted_at} />
      <QuoteRequestNewUrgentBanner isNew={request.status === "new"} isUrgent={request.is_urgent} />

      <div>
        <Link href="/quote-requests" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
          ← Quote requests
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-zinc-900">{request.customer_name}</h1>
          {request.is_urgent ? <QuoteRequestUrgentListBadge isUrgent /> : null}
        </div>
        <p className="mt-1 text-sm text-zinc-600">
          Submitted {formatDateTimeEastern(request.submitted_at)}
          {" · "}
          Status: {quoteRequestStatusLabel(request.status)}
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Customer information</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Name</dt>
            <dd className="font-medium text-zinc-900">{request.customer_name}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Email</dt>
            <dd className="font-medium text-zinc-900">
              <a href={`mailto:${request.customer_email}`} className="text-[#2436BB] hover:underline">
                {request.customer_email}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Phone</dt>
            <dd className="font-medium text-zinc-900">
              {request.customer_phone ? (
                <a href={`tel:${request.customer_phone.replace(/\s/g, "")}`} className="text-[#2436BB] hover:underline">
                  {request.customer_phone}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500">Property address</dt>
            <dd className="font-medium text-zinc-900">{request.property_address}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Project</h2>
        <dl className="mt-3 space-y-3 text-sm">
          <div>
            <dt className="text-zinc-500">Project type</dt>
            <dd className="font-medium text-zinc-900">{request.project_type}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Description</dt>
            <dd className="mt-1 whitespace-pre-wrap text-zinc-800">{request.description}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Urgent</dt>
            <dd className="mt-1">
              <QuoteRequestUrgentDetailBadge isUrgent={request.is_urgent} />
            </dd>
          </div>
        </dl>
      </section>

      {request.attachments.length > 0 ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-base font-semibold text-zinc-900">Photos</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {request.attachments.map((att) =>
              att.signedUrl ? (
                <a
                  key={att.id}
                  href={att.signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={att.signedUrl}
                    alt="Quote request attachment"
                    className="aspect-square w-full object-cover"
                  />
                </a>
              ) : (
                <div
                  key={att.id}
                  className="flex aspect-square items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100 text-xs text-zinc-500"
                >
                  Unavailable
                </div>
              )
            )}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Additional information</h2>
        {request.followUpAnswers.length > 0 ? (
          <dl className="mt-4 space-y-4">
            {request.followUpAnswers.map((item) => (
              <div key={item.id} className="border-b border-zinc-100 pb-4 last:border-b-0 last:pb-0">
                <dt className="text-sm text-zinc-500">{item.question}</dt>
                <dd className="mt-1 text-sm font-medium text-zinc-900">
                  {formatFollowUpAnswerDisplay(item.answer, item.question_type)}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-zinc-600">No additional customer answers yet.</p>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Actions</h2>
        <div className="mt-4">
          <QuoteRequestActionButtons requestId={request.id} />
        </div>
      </section>
    </div>
  );
}
