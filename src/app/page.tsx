"use client";

import { useState } from "react";
import { captureFirstTouchIfMissing, readFirstTouchClient } from "@/lib/attribution-first-touch";
import { trackEvent } from "@/lib/metaPixel";

function WaitlistForm({
  email,
  setEmail,
  province,
  setProvince,
  website,
  setWebsite,
  status,
  message,
  onSubmit,
  compact,
}: {
  email: string;
  setEmail: (v: string) => void;
  province: string;
  setProvince: (v: string) => void;
  website: string;
  setWebsite: (v: string) => void;
  status: "idle" | "loading" | "success" | "error";
  message: string;
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
  compact?: boolean;
}) {
  return (
    <form
      className={`rounded-xl border border-zinc-200 bg-white shadow-sm ${
        compact ? "p-4 sm:p-5" : "p-6 sm:p-8"
      }`}
      onSubmit={onSubmit}
    >
      <h3 className={`font-semibold text-zinc-900 ${compact ? "text-base" : "text-lg"}`}>
        Get Early Access (Free)
      </h3>
      <p className={`text-zinc-500 ${compact ? "mt-0.5 text-xs" : "mt-1 text-sm"}`}>
        We&apos;ll email you when early access opens.
      </p>

      {(status === "success" || status === "error") && message && (
        <p
          className={`mt-3 rounded-lg px-4 py-3 text-sm ${
            status === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}
        >
          {message}
        </p>
      )}

      <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden>
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <div className={compact ? "mt-4 space-y-3" : "mt-6 space-y-4"}>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        <div>
          <label htmlFor="province" className="block text-sm font-medium text-zinc-700">
            Province <span className="text-red-500">*</span>
          </label>
          <select
            id="province"
            name="province"
            required
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            <option value="" disabled>
              Select province
            </option>
            <option value="Ontario">Ontario</option>
            <option value="Alberta">Alberta</option>
            <option value="British Columbia">British Columbia</option>
            <option value="Quebec">Quebec</option>
            <option value="Manitoba">Manitoba</option>
            <option value="Saskatchewan">Saskatchewan</option>
            <option value="Nova Scotia">Nova Scotia</option>
            <option value="New Brunswick">New Brunswick</option>
            <option value="Newfoundland and Labrador">Newfoundland and Labrador</option>
            <option value="Prince Edward Island">Prince Edward Island</option>
            <option value="Northwest Territories">Northwest Territories</option>
            <option value="Yukon">Yukon</option>
            <option value="Nunavut">Nunavut</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={status === "loading"}
        className="mt-4 w-full rounded-lg bg-[#2436BB] px-4 py-3 font-medium text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto sm:px-8"
      >
        {status === "loading" ? "Submitting..." : "Get Early Access (Free)"}
      </button>
      <p className="mt-2 text-xs text-zinc-500">No spam. No calls. Just early access.</p>
    </form>
  );
}

export default function Home() {
  const [email, setEmail] = useState("");
  const [province, setProvince] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const firstTouch =
        readFirstTouchClient() ??
        captureFirstTouchIfMissing(`${window.location.pathname}${window.location.search || ""}`);
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          province: province || undefined,
          source: "jobproof.ca",
          utm_source: firstTouch.utm_source ?? undefined,
          utm_medium: firstTouch.utm_medium ?? undefined,
          utm_campaign: firstTouch.utm_campaign ?? undefined,
          utm_content: firstTouch.utm_content ?? undefined,
          utm_term: firstTouch.utm_term ?? undefined,
          referrer: firstTouch.referrer ?? undefined,
          landing_page: firstTouch.landing_page ?? undefined,
          first_seen_at: firstTouch.first_seen_at ?? undefined,
          website,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        trackEvent("Lead", {
          content_name: "JobProof Early Access",
          status: "submitted",
        });
        if (data.duplicate) {
          setMessage("You're already on the list — we'll be in touch.");
        } else {
          setMessage("You're in. We'll email you with early access details.");
          setEmail("");
          setProvince("");
        }
        setStatus("success");
      } else {
        setMessage(data.error || "Something went wrong. Please try again.");
        setStatus("error");
      }
    } catch {
      setMessage("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      <header className="border-b border-zinc-200 bg-white px-6 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <a href="/">
            <img src="/jobproof-logo.png" alt="JobProof" className="h-10 w-auto" />
          </a>
          <a
            href="/login"
            className="text-sm font-medium text-[#2436BB] hover:text-[#1c2a96]"
          >
            Sign in
          </a>
        </div>
      </header>
      <main>
        {/* 1. Hero */}
        <section className="border-b border-zinc-200 bg-zinc-50/50 px-6 py-8 sm:px-8 sm:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl lg:text-[2.65rem] lg:leading-tight">
              The job is done. The client won&apos;t pay.
              <br />
              Without proof, you don&apos;t get paid.
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-zinc-600 sm:mt-5 sm:text-xl">
              One missing message, photo, or approval can cost you thousands.
              <br className="hidden sm:block" />{" "}
              <span className="sm:whitespace-normal">
                JobProof helps you make sure that never happens.
              </span>
            </p>
            <p className="mt-3 text-sm text-zinc-600 sm:mt-4">
              Built with input from real contractors in Ontario.
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              Used by contractors to avoid payment disputes and get paid faster.
            </p>
            <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:mt-8 sm:flex-row sm:items-start sm:gap-6">
              <div className="flex w-full flex-col items-center sm:w-auto sm:items-start">
                <p className="mb-2 text-sm font-medium text-zinc-700 sm:text-left">
                  Protect your next job before it becomes a problem.
                </p>
                <a
                  href="#early-access"
                  className="w-full rounded-lg bg-[#2436BB] px-6 py-3.5 text-center font-medium text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 sm:w-auto"
                >
                  Get Early Access (Free)
                </a>
                <p className="mt-2 max-w-[18rem] text-center text-xs leading-snug text-zinc-500 sm:text-left">
                  Takes 10 seconds. No commitment. No spam.
                </p>
              </div>
              <a
                href="#protected-job-preview"
                className="w-full rounded-lg border-2 border-[#2436BB] bg-white px-6 py-3.5 text-center font-medium text-[#2436BB] transition-colors hover:bg-[#2436BB]/5 focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 sm:mt-0 sm:w-auto sm:self-center"
              >
                See How It Works
              </a>
            </div>
          </div>
        </section>

        {/* 2. CTA + simplified form (above the fold) */}
        <section
          id="early-access"
          className="scroll-mt-16 border-b border-zinc-200 bg-white px-6 py-4 sm:px-8 sm:py-8"
        >
          <div className="mx-auto max-w-lg">
            <p className="text-center text-sm font-medium text-zinc-700">
              Free. Takes 10 seconds. No commitment.
            </p>
            <div className="mt-2">
              <WaitlistForm
                email={email}
                setEmail={setEmail}
                province={province}
                setProvince={setProvince}
                website={website}
                setWebsite={setWebsite}
                status={status}
                message={message}
                onSubmit={handleSubmit}
                compact
              />
            </div>
          </div>
        </section>

        {/* 3. Loss / proof */}
        <section className="border-b border-zinc-200 bg-zinc-50/40 px-6 py-8 sm:px-8 sm:py-10">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-center text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
              If you don&apos;t have proof, you don&apos;t get paid.
            </h2>
            <ul className="mt-5 space-y-2.5 text-left text-sm text-zinc-700 sm:text-base">
              {[
                "\"I never agreed to that\"",
                "\"That damage was already there\"",
                "\"This wasn't done properly\"",
                "Payment gets delayed... or never comes",
              ].map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="shrink-0 font-semibold text-[#2436BB]">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-center text-base font-semibold text-zinc-900 sm:text-lg">
              Most contractors only realize this after it happens.
            </p>
          </div>
        </section>

        {/* 4. You’ve probably dealt with this */}
        <section
          id="heard-before"
          className="scroll-mt-20 border-b border-zinc-200 px-6 py-10 sm:px-8 sm:py-12"
        >
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              You&apos;ve probably dealt with this before:
            </h2>
            <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2">
              {[
                "I never agreed to that",
                "That damage was already there",
                "The job wasn't done properly",
                "Payment gets delayed or ignored",
              ].map((line) => (
                <div
                  key={line}
                  className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-left text-sm font-medium text-zinc-800 shadow-sm"
                >
                  <span className="mr-2 text-[#2436BB]">•</span>
                  {line}
                </div>
              ))}
            </div>
            <p className="mt-8 text-center text-base font-semibold text-zinc-900 sm:text-lg">
              Most jobs go smoothly. But one bad job can cost you thousands.
            </p>
            <p className="mt-3 text-center text-sm font-medium text-zinc-700">
              And when it happens, it usually comes down to one thing: proof.
            </p>
          </div>
        </section>

        {/* 5. Product walkthrough */}
        <section
          id="protected-job-preview"
          className="scroll-mt-20 border-b-2 border-b-[#4DBACC]/25 bg-gradient-to-b from-zinc-50 to-white px-6 py-12 sm:px-8 sm:py-20"
          aria-labelledby="mock-heading"
        >
          <div className="mx-auto max-w-lg">
            <h2
              id="mock-heading"
              className="text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl"
            >
              Here&apos;s what a protected job looks like in JobProof
            </h2>
            <p className="mx-auto mt-3 max-w-md text-center text-sm text-zinc-600 sm:mt-4">
              This is what you&apos;ll have on every job:
            </p>

            <div
              className="mt-5 overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)] ring-1 ring-zinc-100 sm:mt-6"
              role="img"
              aria-label="Example JobProof job summary card"
            >
              <div className="border-b border-zinc-100 bg-zinc-50/90 px-4 py-3 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Job</p>
                    <p className="text-lg font-semibold text-zinc-900">Deck Building</p>
                    <p className="mt-0.5 text-sm text-zinc-600">Joan Wilson</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200/80">
                    Active
                  </span>
                </div>
                <p className="mt-3 text-2xl font-bold tabular-nums text-[#2436BB]">$5,600</p>
              </div>

              <div className="space-y-0 divide-y divide-zinc-100 px-4 py-2 sm:px-5">
                {[
                  "Contract sent for signature",
                  "Before photos uploaded",
                  "Scope clearly defined",
                  "Change orders tracked",
                  "Job updates documented",
                  "Invoice sent",
                  "Payment status tracked",
                ].map((label) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 py-2.5 text-sm text-zinc-700"
                  >
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700"
                      aria-hidden
                    >
                      ✓
                    </span>
                    {label}
                  </div>
                ))}
              </div>

              <div className="border-t border-zinc-100 bg-zinc-50/80 px-4 py-3 sm:px-5">
                <p className="text-xs font-medium text-zinc-500">Status</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-200/80">
                    Awaiting signed contract
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200/80">
                    Proof on file
                  </span>
                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200/80">
                    Unpaid
                  </span>
                </div>
              </div>
            </div>
            <p className="mx-auto mt-5 max-w-xl text-center text-sm text-zinc-600 sm:mt-6">
              Customers are more likely to pay when everything is clearly documented.
            </p>
            <p className="mt-3 text-center text-sm text-zinc-600">
              If a dispute happens, everything you need is already documented.
            </p>
          </div>
        </section>

        {/* 6. Features */}
        <section
          id="benefits"
          className="scroll-mt-20 border-b border-zinc-200 bg-zinc-50/50 px-6 py-12 sm:px-8 sm:py-16"
        >
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              How JobProof Protects You
            </h2>
            <div className="mt-8 grid gap-6 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 border-l-4 border-l-[#4DBACC] bg-white p-6">
                <h3 className="font-semibold text-zinc-900">Clear contracts</h3>
                <p className="mt-2 text-sm text-zinc-600">
                  No more unclear scope or verbal agreements.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 border-l-4 border-l-[#4DBACC] bg-white p-6">
                <h3 className="font-semibold text-zinc-900">Before / During / After photos</h3>
                <p className="mt-2 text-sm text-zinc-600">Timestamped proof of the job.</p>
              </div>
              <div className="rounded-xl border border-zinc-200 border-l-4 border-l-[#4DBACC] bg-white p-6">
                <h3 className="font-semibold text-zinc-900">Change order tracking</h3>
                <p className="mt-2 text-sm text-zinc-600">
                  No more &lsquo;I didn&apos;t approve that&rsquo;.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 border-l-4 border-l-[#4DBACC] bg-white p-6">
                <h3 className="font-semibold text-zinc-900">Dispute-ready documentation</h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Everything organized if something goes wrong.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 border-l-4 border-l-[#4DBACC] bg-white p-6">
                <h3 className="font-semibold text-zinc-900">Invoices and payments</h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Send invoices, accept payments, and keep a clear record of every job.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 border-l-4 border-l-[#4DBACC] bg-white p-6">
                <h3 className="font-semibold text-zinc-900">Professional workflow</h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Look more professional, reduce stress.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Pricing */}
        <section
          id="pricing"
          className="scroll-mt-20 border-b border-zinc-200 px-6 py-12 sm:px-8 sm:py-16"
        >
          <div className="mx-auto max-w-2xl">
            <p className="text-center text-lg font-medium leading-relaxed text-zinc-800">
              One disputed job can cost thousands in lost revenue or legal fees. JobProof costs less
              than a single mistake.
            </p>
            <p className="mt-3 text-center text-sm text-zinc-600">
              Founding members lock in early access pricing before public launch.
            </p>
            <p className="mt-2 text-center text-sm text-zinc-600">
              Invoices and payments are part of the JobProof workflow.
            </p>
            <h2 className="mt-8 text-center text-2xl font-bold tracking-tight text-zinc-900 sm:mt-10 sm:text-3xl">
              Simple, Transparent Pricing
            </h2>
            <div className="mt-8 grid gap-6 sm:mt-12 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-white p-6">
                <h3 className="font-semibold text-zinc-900">Essential Protection</h3>
                <p className="mt-2 text-2xl font-bold text-zinc-900">$39</p>
                <p className="text-sm text-zinc-500">per month</p>
                <p className="mt-1 text-xs text-zinc-500">For solo contractors (1 user)</p>
                <p className="mt-4 text-sm text-zinc-600">
                  Core contracts, job documentation, and dispute-ready records designed for solo
                  contractors.
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  Less than the cost of fixing one mistake on a job.
                </p>
              </div>
              <div className="rounded-xl border-2 border-[#2436BB] bg-zinc-900 p-6 text-white shadow-[0_0_16px_rgba(36,54,187,0.2)]">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">Professional Protection</h3>
                  <span className="rounded-full bg-[#F26C36] px-2 py-0.5 text-xs font-medium text-white">
                    Most Popular
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold">$59</p>
                <p className="text-sm text-zinc-300">per month</p>
                <p className="mt-1 text-xs text-zinc-400">
                  For teams of 2–5 contractors (each member gets access)
                </p>
                <p className="mt-4 text-sm text-zinc-300">
                  Everything in Essential, plus multi-user access, advanced features, AI risk
                  scanning, and priority support.
                </p>
                <p className="mt-2 text-xs text-zinc-400">Less than the cost of one service call.</p>
              </div>
            </div>
            <p className="mt-6 text-center text-xs text-zinc-500 sm:mt-8">
              Join early and keep this pricing as a founding member.
            </p>
          </div>
        </section>

        {/* 8. Final CTA */}
        <section className="bg-zinc-50/50 px-6 py-10 sm:px-8 sm:py-14">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
              Don&apos;t wait for a dispute to wish you had proof.
            </h2>
            <p className="mt-3 text-sm text-zinc-600">
              Free. Takes 10 seconds. No commitment. No spam.
            </p>
            <a
              href="#early-access"
              className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-[#2436BB] px-6 py-3.5 font-medium text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 sm:w-auto"
            >
              Get Early Access (Free)
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
