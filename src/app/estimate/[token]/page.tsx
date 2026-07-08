import type { ReactNode } from "react";
import type { Metadata } from "next";
import { after } from "next/server";
import { PublicEstimateToolbar } from "@/components/public-estimate-toolbar";
import {
  fetchPublicEstimatePageData,
  isValidPublicEstimateToken,
  markPublicEstimateViewedOnce,
} from "@/lib/estimate-public";
import {
  submitAcceptEstimate,
  submitDeclineEstimate,
  submitEstimateChangeRequest,
  submitEstimateQuestion,
} from "./public-estimate-actions";

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

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-zinc-200 pt-6 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function BulletList({
  items,
  icon = "•",
}: {
  items: string[];
  icon?: string;
}) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-sm leading-6 text-zinc-700 sm:text-[15px]">
          <span className="mt-0.5 font-semibold text-[#2436BB]">{icon}</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function StatusCard({
  title,
  body,
  tone = "neutral",
}: {
  title: string;
  body: string;
  tone?: "neutral" | "success" | "warning";
}) {
  const toneClasses =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-zinc-200 bg-white text-zinc-900";

  return (
    <div className={`rounded-2xl border p-8 text-center shadow-sm ${toneClasses}`}>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-sm leading-6 sm:text-[15px]">{body}</p>
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
  const outcome =
    typeof sp.outcome === "string"
      ? sp.outcome
      : Array.isArray(sp.outcome)
        ? sp.outcome[0]
        : undefined;
  const reason =
    typeof sp.reason === "string"
      ? sp.reason
      : Array.isArray(sp.reason)
        ? sp.reason[0]
        : undefined;

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

  const { contractor: c } = data;
  const proposal = data.proposal;

  if (outcome === "accepted") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-16">
        <div className="w-full max-w-xl">
          <StatusCard
            title="Quote Accepted"
            body="Thank you. Your contractor has been notified and will follow up with you about the next steps."
            tone="success"
          />
          {proposal.nextSteps.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-zinc-950">What happens next</h2>
              <div className="mt-3">
                <BulletList items={proposal.nextSteps} icon="✓" />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (outcome === "declined") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-16">
        <div className="w-full max-w-xl">
          <StatusCard
            title="Quote Declined"
            body="Your response has been recorded. If you would like to revisit anything, contact your contractor and they can prepare an updated quote."
          />
        </div>
      </div>
    );
  }

  if (outcome === "error") {
    const copy =
      reason === "expired"
        ? "This quote is no longer open for a response."
        : reason === "already_answered"
        ? "This quote has already received a response."
        : reason === "invalid_message"
          ? "Please enter a little more detail so your contractor can help."
          : "We could not record your response. Please try again or contact your contractor.";
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-16">
        <div className="w-full max-w-xl">
          <StatusCard title="Something went wrong" body={copy} tone="warning" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 print:bg-white">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10 print:max-w-none print:py-4">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2436BB]">
              Project Quote
            </p>
            <h1 className="mt-2 text-2xl font-bold text-zinc-950 sm:text-3xl">{data.title}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {data.estimateNumberLabel}
              {data.expiryDateLabel ? ` · Valid until ${data.expiryDateLabel}` : ""}
            </p>
          </div>
          <PublicEstimateToolbar token={data.token} hasPdf={data.hasPdf} />
        </header>

        {data.displayStatus === "expired" && (
          <div className="mb-6 rounded-2xl border border-zinc-300 bg-white px-5 py-4 text-sm text-zinc-800 shadow-sm">
            <p className="font-semibold text-zinc-950">This quote is no longer open for a response.</p>
            <p className="mt-2 text-zinc-600">
              Please contact {c.businessName} if you would like an updated quote.
            </p>
          </div>
        )}

        {(outcome === "question_sent" || outcome === "changes_requested") && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-950 shadow-sm">
            <p className="font-semibold">
              {outcome === "question_sent" ? "Your question has been sent." : "Your change request has been sent."}
            </p>
            <p className="mt-1">
              {c.businessName} has been notified and your message is now attached to this quote.
            </p>
          </div>
        )}

        <div className="space-y-6 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8 print:border-0 print:shadow-none">
          <Section title="Contractor">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                {c.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.logoUrl}
                    alt=""
                    className="h-14 w-auto max-w-[180px] object-contain"
                  />
                ) : null}
                <div>
                  <p className="text-xl font-semibold text-zinc-950">{c.businessName}</p>
                  {c.contactName ? <p className="mt-1 text-sm text-zinc-600">{c.contactName}</p> : null}
                </div>
              </div>
              <div className="space-y-1 text-sm text-zinc-600 sm:text-right">
                {c.phone ? (
                  <p>
                    <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="hover:text-zinc-900">
                      {c.phone}
                    </a>
                  </p>
                ) : null}
                {c.email ? (
                  <p>
                    <a href={`mailto:${c.email}`} className="hover:text-zinc-900">
                      {c.email}
                    </a>
                  </p>
                ) : null}
              </div>
            </div>
          </Section>

          <Section title="Welcome">
            <p className="max-w-3xl text-sm leading-7 text-zinc-700 sm:text-[15px]">
              {proposal.welcomeMessage}
            </p>
          </Section>

          <Section title="Project overview">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-zinc-500">Project title</p>
                <p className="mt-1 text-base font-semibold text-zinc-950">{proposal.projectTitle}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-500">Date prepared</p>
                <p className="mt-1 text-base text-zinc-800">{data.issueDateLabel}</p>
              </div>
              {proposal.projectSummary ? (
                <div className="sm:col-span-2">
                  <p className="text-sm font-medium text-zinc-500">Summary</p>
                  <p className="mt-1 text-sm leading-7 text-zinc-700 sm:text-[15px]">
                    {proposal.projectSummary}
                  </p>
                </div>
              ) : null}
              {data.propertyAddressLines.length > 0 ? (
                <div className="sm:col-span-2">
                  <p className="text-sm font-medium text-zinc-500">Property address</p>
                  <div className="mt-1 space-y-1 text-sm text-zinc-700 sm:text-[15px]">
                    {data.propertyAddressLines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Section>

          <Section title="Scope of work">
            <BulletList items={proposal.scopeOfWork.length ? proposal.scopeOfWork : [data.scopeOfWork || "Project work as discussed."]} />
          </Section>

          <Section title="What&apos;s included">
            <BulletList items={proposal.includedWork.length ? proposal.includedWork : ["Completion of the quoted work", "Site cleanup"]} icon="✓" />
          </Section>

          {proposal.optionalUpgrades.length > 0 ? (
            <Section title="Optional upgrades">
              <div className="space-y-3">
                {proposal.optionalUpgrades.map((upgrade, index) => (
                  <div key={`${upgrade.title}-${index}`} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-zinc-950">{upgrade.title}</p>
                        {upgrade.description ? (
                          <p className="mt-1 text-sm leading-6 text-zinc-600">{upgrade.description}</p>
                        ) : null}
                      </div>
                      <p className="text-sm font-semibold text-zinc-900">
                        {upgrade.additionalPrice != null ? `+$${money(upgrade.additionalPrice)}` : "Price available on request"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {proposal.exclusions.length > 0 ? (
            <Section title="What&apos;s not included">
              <BulletList items={proposal.exclusions} />
            </Section>
          ) : null}

          <Section title="Pricing">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
              <dl className="space-y-3">
                {proposal.pricingItems.map((item) => (
                  <div key={item.label} className="flex items-start justify-between gap-4">
                    <div>
                      <dt className="text-sm font-medium text-zinc-900 sm:text-[15px]">{item.label}</dt>
                      {item.description ? (
                        <dd className="mt-1 text-sm leading-6 text-zinc-500">{item.description}</dd>
                      ) : null}
                    </div>
                    <dd className="shrink-0 text-sm font-semibold tabular-nums text-zinc-950 sm:text-[15px]">
                      ${money(item.amount)}
                    </dd>
                  </div>
                ))}
                <div className="border-t border-zinc-200 pt-3" />
                <div className="flex justify-between gap-4 text-sm text-zinc-700 sm:text-[15px]">
                  <dt>Subtotal</dt>
                  <dd className="font-medium tabular-nums">${money(proposal.subtotal)}</dd>
                </div>
                <div className="flex justify-between gap-4 text-sm text-zinc-700 sm:text-[15px]">
                  <dt>{proposal.taxRateLabel ? `Tax (${proposal.taxRateLabel})` : "Tax"}</dt>
                  <dd className="font-medium tabular-nums">${money(proposal.taxAmount)}</dd>
                </div>
                {proposal.depositAmount != null ? (
                  <div className="flex justify-between gap-4 text-sm text-zinc-700 sm:text-[15px]">
                    <dt>Deposit</dt>
                    <dd className="font-medium tabular-nums">${money(proposal.depositAmount)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4 border-t border-zinc-200 pt-3 text-base font-semibold text-zinc-950">
                  <dt>Total</dt>
                  <dd className="tabular-nums">${money(proposal.total)}</dd>
                </div>
              </dl>
            </div>
          </Section>

          <Section title="Timeline">
            {proposal.timeline.duration || proposal.timeline.startWindow || proposal.timeline.completion ? (
              <dl className="grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-sm font-medium text-zinc-500">Estimated duration</dt>
                  <dd className="mt-1 text-sm text-zinc-800 sm:text-[15px]">
                    {proposal.timeline.duration ?? "Scheduling will be confirmed after acceptance."}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-zinc-500">Expected start window</dt>
                  <dd className="mt-1 text-sm text-zinc-800 sm:text-[15px]">
                    {proposal.timeline.startWindow ?? "To be confirmed after acceptance."}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-zinc-500">Estimated completion</dt>
                  <dd className="mt-1 text-sm text-zinc-800 sm:text-[15px]">
                    {proposal.timeline.completion ?? "To be confirmed after acceptance."}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm leading-7 text-zinc-700 sm:text-[15px]">
                {proposal.timeline.fallbackText ?? "Scheduling will be confirmed after acceptance."}
              </p>
            )}
          </Section>

          {proposal.warranty ? (
            <Section title="Warranty">
              <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-700 sm:text-[15px]">
                {proposal.warranty}
              </p>
            </Section>
          ) : null}

          <Section title="Questions or changes">
            <div id="questions-or-changes" className="space-y-4">
              <p className="text-sm leading-7 text-zinc-700 sm:text-[15px]">
                {proposal.questionsOrChangesIntro}
              </p>
              {data.canRespond ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <form
                    action={submitEstimateQuestion.bind(null, data.token)}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                  >
                    <h3 className="text-sm font-semibold text-zinc-950">Ask a Question</h3>
                    <p className="mt-1 text-sm text-zinc-600">
                      Ask for clarification about anything in the quote.
                    </p>
                    <textarea
                      name="message"
                      required
                      minLength={5}
                      className="mt-3 min-h-28 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-0 placeholder:text-zinc-400 focus:border-[#2436BB]"
                      placeholder="Type your question here"
                    />
                    <button
                      type="submit"
                      className="mt-3 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
                    >
                      Ask a Question
                    </button>
                  </form>

                  <form
                    action={submitEstimateChangeRequest.bind(null, data.token)}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                  >
                    <h3 className="text-sm font-semibold text-zinc-950">Request Changes</h3>
                    <p className="mt-1 text-sm text-zinc-600">
                      Let the contractor know what you would like revised.
                    </p>
                    <textarea
                      name="message"
                      required
                      minLength={5}
                      className="mt-3 min-h-28 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-0 placeholder:text-zinc-400 focus:border-[#2436BB]"
                      placeholder="Describe what you would like changed"
                    />
                    <button
                      type="submit"
                      className="mt-3 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
                    >
                      Request Changes
                    </button>
                  </form>
                </div>
              ) : (
                <p className="text-sm text-zinc-600">
                  This quote is not open for updates right now.
                </p>
              )}
            </div>
          </Section>

          <Section title="Accept / Request Changes / Decline">
            {data.canRespond ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <form action={submitAcceptEstimate.bind(null, data.token)}>
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-[#2436BB] px-5 py-3 text-sm font-medium text-white hover:bg-[#1f2fa5] sm:w-auto"
                  >
                    Accept Quote
                  </button>
                </form>
                <a
                  href="#questions-or-changes"
                  className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                >
                  Request Changes
                </a>
                <a
                  href="#questions-or-changes"
                  className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                >
                  Ask a Question
                </a>
                <form action={submitDeclineEstimate.bind(null, data.token)}>
                  <button
                    type="submit"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 sm:w-auto"
                  >
                    Decline Quote
                  </button>
                </form>
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                {data.displayStatus === "expired" ? (
                  <p>Please contact {c.businessName} if you would like an updated quote.</p>
                ) : data.dbStatus === "accepted" ? (
                  <p>This quote has already been accepted. Thank you.</p>
                ) : data.dbStatus === "declined" ? (
                  <p>This quote has already been declined.</p>
                ) : (
                  <p>This quote is not open for responses right now.</p>
                )}
              </div>
            )}
          </Section>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500 print:hidden">
          Secured by JobProof
        </p>
      </div>
    </div>
  );
}
