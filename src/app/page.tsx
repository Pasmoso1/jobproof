"use client";

import { useState } from "react";

export default function Home() {
  const [email, setEmail] = useState("");
  const [trade, setTrade] = useState("");
  const [city, setCity] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          trade: trade || undefined,
          city: city || undefined,
          source: "jobproof.ca",
          website,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        if (data.duplicate) {
          setMessage("You're already on the list — we'll be in touch.");
        } else {
          setMessage("You're in. We'll email you with early access details.");
          setEmail("");
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
            <img
              src="/jobproof-logo.png"
              alt="JobProof"
              className="h-10 w-auto"
            />
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
        {/* Hero */}
        <section className="border-b border-zinc-200 bg-zinc-50/50 px-6 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl lg:text-[2.65rem] lg:leading-tight">
              When a customer says &lsquo;I never agreed to that&rsquo;&hellip; will you have proof?
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-zinc-600 sm:text-xl">
              JobProof helps contractors document every job, track approvals, and get paid &mdash;
              with clear contracts, photos, and dispute-ready records.
            </p>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-zinc-500">
              Most contractors only realize they need this after a dispute. By then, it&apos;s too
              late.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-6 sm:flex-row sm:items-start sm:gap-8">
              <div className="flex w-full flex-col items-center sm:w-auto sm:items-start">
                <a
                  href="#early-access"
                  className="w-full rounded-lg bg-[#2436BB] px-6 py-3.5 text-center font-medium text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 sm:w-auto"
                >
                  Request Early Access
                </a>
                <p className="mt-2 max-w-[16rem] text-center text-xs leading-snug text-zinc-500 sm:text-left">
                  Free. No commitment. Early users get discounted launch pricing.
                </p>
                <p className="mt-1 max-w-[16rem] text-center text-xs leading-snug text-zinc-500 sm:text-left">
                  Takes 10 seconds. No spam.
                </p>
              </div>
              <a
                href="#how-it-works"
                className="w-full rounded-lg border-2 border-[#2436BB] bg-white px-6 py-3.5 text-center font-medium text-[#2436BB] transition-colors hover:bg-[#2436BB]/5 focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 sm:mt-0 sm:w-auto sm:self-center"
              >
                See How It Works
              </a>
            </div>
            <p className="mt-8 text-sm text-zinc-500">
              Built for contractors across Ontario.
            </p>
            <p className="mt-2 text-xs text-zinc-400">
              Built with feedback from Ontario contractors
            </p>
          </div>
        </section>

        {/* Problem — bullet cards */}
        <section
          id="heard-before"
          className="scroll-mt-20 border-b border-zinc-200 px-6 py-14 sm:px-8 sm:py-16"
        >
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              You&apos;ve probably dealt with this before:
            </h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
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
            <p className="mt-10 text-center text-base font-semibold text-zinc-900 sm:text-lg">
              Most jobs go smoothly. But one bad job can cost you thousands.
            </p>
            <p className="mt-4 text-center text-sm font-medium text-zinc-700">
              And when it happens, it usually comes down to one thing: proof.
            </p>
          </div>
        </section>

        {/* Product UI mock — visual focal point */}
        <section
          id="protected-job-preview"
          className="scroll-mt-20 border-b-2 border-b-[#4DBACC]/25 bg-gradient-to-b from-zinc-50 to-white px-6 py-16 sm:px-8 sm:py-24"
          aria-labelledby="mock-heading"
        >
          <div className="mx-auto max-w-lg">
            <h2
              id="mock-heading"
              className="text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl"
            >
              Here&apos;s what a protected job looks like in JobProof
            </h2>
            <p className="mx-auto mt-4 max-w-md text-center text-sm text-zinc-600">
              This is what you&apos;ll have on every job:
            </p>

            <div
              className="mt-6 overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)] ring-1 ring-zinc-100"
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
                </div>
              </div>
            </div>
            <p className="mt-6 text-center text-sm text-zinc-600">
              If a dispute happens, everything you need is already documented.
            </p>
          </div>
        </section>

        {/* Who it's for */}
        <section
          id="who-its-for"
          className="scroll-mt-20 border-b border-zinc-200 px-6 py-14 sm:px-8 sm:py-16"
        >
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              Who JobProof Is Built For
            </h2>

            <p className="mt-6 text-center text-zinc-600 leading-relaxed">
              Built for contractors who want to protect their work, avoid misunderstandings, and
              have clear records when customers question what was agreed.
            </p>

            <div className="mt-12 grid gap-8 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 border-l-4 border-l-[#4DBACC] bg-white p-6">
                <h3 className="font-semibold text-zinc-900">Best for</h3>
                <ul className="mt-3 space-y-2 text-sm text-zinc-600">
                  <li>Independent contractors</li>
                  <li>Small teams</li>
                  <li>Painters</li>
                  <li>Plumbers</li>
                  <li>Renovators</li>
                  <li>HVAC</li>
                  <li>Electricians</li>
                  <li>Flooring installers</li>
                  <li>Roofers</li>
                  <li>Landscapers</li>
                  <li>General contracting</li>
                </ul>
              </div>

              <div className="rounded-xl border border-zinc-200 border-l-4 border-l-[#4DBACC] bg-white p-6">
                <h3 className="font-semibold text-zinc-900">Probably not necessary for</h3>
                <ul className="mt-3 space-y-2 text-sm text-zinc-600">
                  <li>Large commercial construction companies</li>
                  <li>Firms with dedicated legal or compliance departments</li>
                  <li>Companies already running complex enterprise project management systems</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* How JobProof protects you */}
        <section
          id="benefits"
          className="scroll-mt-20 border-b border-zinc-200 bg-zinc-50/50 px-6 py-14 sm:px-8 sm:py-16"
        >
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              How JobProof Protects You
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                <h3 className="font-semibold text-zinc-900">Invoices + records</h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Clear payment history and job completion proof.
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

        {/* How it works */}
        <section
          id="how-it-works"
          className="scroll-mt-20 border-b-2 border-b-[#4DBACC]/20 px-6 py-14 sm:px-8 sm:py-16"
        >
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              How it works
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#2436BB] text-lg font-bold text-white">
                  1
                </div>
                <h3 className="mt-4 font-semibold text-zinc-900">Create the job</h3>
                <p className="mt-2 text-sm text-zinc-600">Set up customer + scope.</p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#2436BB] text-lg font-bold text-white">
                  2
                </div>
                <h3 className="mt-4 font-semibold text-zinc-900">Send a clear contract</h3>
                <p className="mt-2 text-sm text-zinc-600">Client signs before work begins.</p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#2436BB] text-lg font-bold text-white">
                  3
                </div>
                <h3 className="mt-4 font-semibold text-zinc-900">Document the job</h3>
                <p className="mt-2 text-sm text-zinc-600">Add photos, notes, updates.</p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#2436BB] text-lg font-bold text-white">
                  4
                </div>
                <h3 className="mt-4 font-semibold text-zinc-900">Get paid with proof</h3>
                <p className="mt-2 text-sm text-zinc-600">Invoices + records protect you.</p>
              </div>
            </div>
          </div>
        </section>

        {/* When things go wrong */}
        <section
          id="when-things-go-wrong"
          className="scroll-mt-20 border-b border-zinc-200 bg-zinc-50/50 px-6 py-14 sm:px-8 sm:py-16"
        >
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              When things go wrong
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 border-l-4 border-l-[#4DBACC] bg-white p-6">
                <h3 className="font-semibold text-zinc-900">
                  Customer says damage was already there
                </h3>
                <p className="mt-2 text-sm text-zinc-600">
                  <span className="font-semibold text-[#2436BB]">→</span> Your before photos prove
                  otherwise.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 border-l-4 border-l-[#4DBACC] bg-white p-6">
                <h3 className="font-semibold text-zinc-900">Scope becomes unclear</h3>
                <p className="mt-2 text-sm text-zinc-600">
                  <span className="font-semibold text-[#2436BB]">→</span> Your contract defines
                  exactly what was agreed.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 border-l-4 border-l-[#4DBACC] bg-white p-6">
                <h3 className="font-semibold text-zinc-900">Customer claims poor work</h3>
                <p className="mt-2 text-sm text-zinc-600">
                  <span className="font-semibold text-[#2436BB]">→</span> Your documentation shows
                  the full process.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 border-l-4 border-l-[#4DBACC] bg-white p-6">
                <h3 className="font-semibold text-zinc-900">Payment is delayed</h3>
                <p className="mt-2 text-sm text-zinc-600">
                  <span className="font-semibold text-[#2436BB]">→</span> Your records support your
                  case.
                </p>
              </div>
            </div>
            <p className="mt-10 text-center text-sm font-semibold text-zinc-700">
              Built for real contractor jobs &mdash; not office software.
            </p>
          </div>
        </section>

        {/* Pricing preview */}
        <section
          id="pricing"
          className="scroll-mt-20 border-b border-zinc-200 px-6 py-14 sm:px-8 sm:py-16"
        >
          <div className="mx-auto max-w-2xl">
            <p className="text-center text-lg font-medium leading-relaxed text-zinc-800">
              One disputed job can cost thousands in lost revenue or legal fees. JobProof costs less
              than a single mistake.
            </p>
            <h2 className="mt-10 text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              Simple, Transparent Pricing
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-white p-6">
                <h3 className="font-semibold text-zinc-900">Essential Protection</h3>
                <p className="mt-2 text-2xl font-bold text-zinc-900">$39</p>
                <p className="text-sm text-zinc-500">per month</p>
                <p className="mt-1 text-xs text-zinc-500">Built for solo contractors</p>
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
                  Built for growing contractors and small teams
                </p>
                <p className="mt-4 text-sm text-zinc-300">
                  Everything in Essential, plus advanced features, AI risk scanning, and priority
                  support.
                </p>
                <p className="mt-2 text-xs text-zinc-400">Less than the cost of one service call.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Early access + form */}
        <section
          id="early-access"
          className="scroll-mt-20 bg-zinc-50/50 px-6 py-14 sm:px-8 sm:py-16"
        >
          <div className="mx-auto max-w-2xl">
            <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              Start protecting your jobs before problems happen
            </h2>
            <p className="mt-6 text-center text-zinc-600 leading-relaxed">
              We&apos;re opening early access to a small number of contractors first. Join now and
              help shape JobProof before launch.
            </p>

            <form
              className="mt-12 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"
              onSubmit={handleSubmit}
            >
              <h3 className="text-lg font-semibold text-zinc-900">Request Early Access</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Be the first to know when we launch.
              </p>

              {(status === "success" || status === "error") && message && (
                <p
                  className={`mt-4 rounded-lg px-4 py-3 text-sm ${
                    status === "success"
                      ? "bg-green-50 text-green-800"
                      : "bg-red-50 text-red-800"
                  }`}
                >
                  {message}
                </p>
              )}

              <div
                className="absolute -left-[9999px] h-px w-px overflow-hidden"
                aria-hidden
              >
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-zinc-700"
                  >
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
                  <label
                    htmlFor="trade"
                    className="block text-sm font-medium text-zinc-700"
                  >
                    Trade <span className="text-zinc-400">(optional)</span>
                  </label>
                  <input
                    id="trade"
                    type="text"
                    value={trade}
                    onChange={(e) => setTrade(e.target.value)}
                    placeholder="e.g. Plumbing, Electrical, HVAC, Renovations, Landscaping"
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="city"
                    className="block text-sm font-medium text-zinc-700"
                  >
                    City <span className="text-zinc-400">(optional)</span>
                  </label>
                  <input
                    id="city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. London, ON"
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={status === "loading"}
                className="mt-6 w-full rounded-lg bg-[#2436BB] px-4 py-3 font-medium text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto sm:px-8"
              >
                {status === "loading" ? "Submitting..." : "Request Early Access"}
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
