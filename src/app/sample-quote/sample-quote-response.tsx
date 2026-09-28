"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ContractorAcquisitionCtaLink } from "@/components/contractor-funnel-trackers";

type DemoNotice = "question" | "changes" | "declined" | null;

const textareaClassName =
  "mt-3 min-h-28 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-0 placeholder:text-zinc-400 focus:border-[#2436BB]";
const secondaryButtonClassName =
  "inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-zinc-200 pt-6">
      <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function noticeCopy(notice: Exclude<DemoNotice, null>, businessName: string) {
  if (notice === "declined") {
    return {
      title: "Sample only: the quote would be marked as declined.",
      body: `In a real quote, the customer's response is recorded and ${businessName} is notified. Nothing was sent.`,
    };
  }
  return {
    title:
      notice === "question"
        ? "Sample only: your question would be sent."
        : "Sample only: your change request would be sent.",
    body: `In a real quote, ${businessName} is notified and the message is attached to this quote. Nothing was sent.`,
  };
}

export function SampleQuoteResponse({
  businessName,
  questionsOrChangesIntro,
  nextSteps,
}: {
  businessName: string;
  questionsOrChangesIntro: string;
  nextSteps: string[];
}) {
  const [accepted, setAccepted] = useState(false);
  const [notice, setNotice] = useState<DemoNotice>(null);
  const acceptedHeadingRef = useRef<HTMLHeadingElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (accepted) acceptedHeadingRef.current?.focus();
  }, [accepted]);

  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);

  function handleDemoMessage(kind: "question" | "changes") {
    return (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      event.currentTarget.reset();
      setNotice(kind);
    };
  }

  if (accepted) {
    return (
      <section className="border-t border-zinc-200 pt-6" aria-live="polite">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center text-emerald-950 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">
            Sample
          </p>
          <h2
            ref={acceptedHeadingRef}
            tabIndex={-1}
            className="mt-2 text-2xl font-semibold focus:outline-none"
          >
            Quote Accepted
          </h2>
          <p className="mt-3 text-sm leading-6 sm:text-[15px]">
            This is what your customer sees after accepting. In a real quote, you&apos;re notified
            right away, and you can turn the accepted quote into a job and send a digital contract
            for signature. Nothing was sent from this sample.
          </p>
        </div>
        {nextSteps.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-zinc-950">What happens next</h3>
            <ul className="mt-3 space-y-2">
              {nextSteps.map((step) => (
                <li key={step} className="flex gap-3 text-sm leading-6 text-zinc-700 sm:text-[15px]">
                  <span className="mt-0.5 font-semibold text-[#2436BB]" aria-hidden>
                    ✓
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <ContractorAcquisitionCtaLink
            href="/signup"
            ctaText="Create Quotes Like This"
            ctaLocation="sample_quote_accepted"
            className="inline-flex w-full items-center justify-center rounded-xl bg-[#2436BB] px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 sm:w-auto"
          >
            Create Quotes Like This
          </ContractorAcquisitionCtaLink>
          <button
            type="button"
            onClick={() => setAccepted(false)}
            className={`${secondaryButtonClassName} w-full sm:w-auto`}
          >
            View the quote again
          </button>
        </div>
      </section>
    );
  }

  const noticeText = notice ? noticeCopy(notice, businessName) : null;

  return (
    <>
      <Section title="Questions or changes">
        <div id="questions-or-changes" className="space-y-4">
          <p className="text-sm leading-7 text-zinc-700 sm:text-[15px]">{questionsOrChangesIntro}</p>
          {noticeText ? (
            <div
              ref={noticeRef}
              tabIndex={-1}
              role="status"
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-950 shadow-sm focus:outline-none"
            >
              <p className="font-semibold">{noticeText.title}</p>
              <p className="mt-1">{noticeText.body}</p>
            </div>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            <form
              onSubmit={handleDemoMessage("question")}
              className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
            >
              <h3 className="text-sm font-semibold text-zinc-950">Ask a Question</h3>
              <p className="mt-1 text-sm text-zinc-600">
                Ask for clarification about anything in the quote.
              </p>
              <label htmlFor="sample-question" className="sr-only">
                Your question
              </label>
              <textarea
                id="sample-question"
                name="message"
                required
                minLength={5}
                className={textareaClassName}
                placeholder="Type your question here"
              />
              <button type="submit" className={`${secondaryButtonClassName} mt-3 px-4 py-2.5`}>
                Ask a Question
              </button>
            </form>

            <form
              onSubmit={handleDemoMessage("changes")}
              className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
            >
              <h3 className="text-sm font-semibold text-zinc-950">Request Changes</h3>
              <p className="mt-1 text-sm text-zinc-600">
                Let the contractor know what you would like revised.
              </p>
              <label htmlFor="sample-changes" className="sr-only">
                Changes you would like
              </label>
              <textarea
                id="sample-changes"
                name="message"
                required
                minLength={5}
                className={textareaClassName}
                placeholder="Describe what you would like changed"
              />
              <button type="submit" className={`${secondaryButtonClassName} mt-3 px-4 py-2.5`}>
                Request Changes
              </button>
            </form>
          </div>
        </div>
      </Section>

      <Section title="Accept / Request Changes / Decline">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setAccepted(true);
            }}
            className="w-full rounded-xl bg-[#2436BB] px-5 py-3 text-sm font-medium text-white hover:bg-[#1f2fa5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2 sm:w-auto"
          >
            Accept Quote
          </button>
          <a href="#questions-or-changes" className={secondaryButtonClassName}>
            Request Changes
          </a>
          <a href="#questions-or-changes" className={secondaryButtonClassName}>
            Ask a Question
          </a>
          <button
            type="button"
            onClick={() => setNotice("declined")}
            className={`${secondaryButtonClassName} w-full sm:w-auto`}
          >
            Decline Quote
          </button>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Try the buttons. This sample never sends or saves anything.
        </p>
      </Section>
    </>
  );
}
