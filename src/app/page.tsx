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
      <main>
        {/* Hero */}
        <section className="border-b border-zinc-200 bg-zinc-50/50 px-6 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl lg:text-5xl">
              <span className="text-[#2436BB]">Protect</span> Every Job. Get Paid. Stay Protected.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-zinc-600 sm:text-xl">
              Job Proof helps Ontario contractors create clear contracts,
              document every job properly, and generate professional dispute
              documentation — so you stay protected when problems happen.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="#early-access"
                className="w-full rounded-lg bg-[#2436BB] px-6 py-3.5 text-center font-medium text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 sm:w-auto"
              >
                Request Early Access
              </a>
              <a
                href="#how-it-works"
                className="w-full rounded-lg border-2 border-[#2436BB] bg-white px-6 py-3.5 text-center font-medium text-[#2436BB] transition-colors hover:bg-[#2436BB]/5 focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 sm:w-auto"
              >
                See How It Works
              </a>
            </div>
          </div>
        </section>

        {/* Who it's for */}
        <section
          id="who-its-for"
          className="scroll-mt-20 border-b border-zinc-200 px-6 py-16 sm:px-8 sm:py-20"
        >
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              Who Job Proof Is Built For
            </h2>

            <p className="mt-6 text-center text-zinc-600 leading-relaxed">
              Job Proof is designed for contractors who want to protect their work,
              document jobs properly, and reduce disputes with clear contracts and
              professional records.
            </p>

            <div className="mt-12 grid gap-8 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 border-l-4 border-l-[#4DBACC] bg-white p-6">
                <h3 className="font-semibold text-zinc-900">Great for</h3>
                <ul className="mt-3 space-y-2 text-sm text-zinc-600">
                  <li>Independent contractors</li>
                  <li>Small contractor teams</li>
                  <li>Plumbers</li>
                  <li>HVAC technicians</li>
                  <li>Electricians</li>
                  <li>Flooring installers</li>
                  <li>Painters</li>
                  <li>Roofers</li>
                  <li>Landscapers</li>
                  <li>Renovation contractors</li>
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

        {/* Problem */}
        <section
          id="problem"
          className="scroll-mt-20 border-b-2 border-b-[#4DBACC]/20 px-6 py-16 sm:px-8 sm:py-20"
        >
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              Disputes Don&apos;t Happen Often — Until They Do.
            </h2>
            <p className="mt-6 text-zinc-600 leading-relaxed">
              Most jobs go smoothly. But when a client claims damage was already
              there, scope was unclear, or payment gets withheld, you need proof.
              Unclear contracts, unsigned change orders, and missing documentation
              can cost you money, time, and reputation. Job Proof gives you the
              structure and evidence to protect yourself before disputes happen.
            </p>
          </div>
        </section>

        {/* Benefits */}
        <section
          id="benefits"
          className="scroll-mt-20 border-b border-zinc-200 bg-zinc-50/50 px-6 py-16 sm:px-8 sm:py-20"
        >
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              Why Contractors Use Job Proof
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 border-l-4 border-l-[#4DBACC] bg-white p-6">
                <h3 className="font-semibold text-zinc-900">Clear contracts</h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Structured, professional contracts that define scope and
                  expectations from the start.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 border-l-4 border-l-[#4DBACC] bg-white p-6">
                <h3 className="font-semibold text-zinc-900">
                  Before / During / After documentation
                </h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Document the job at every stage with photos and notes — so you
                  have proof when it matters.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 border-l-4 border-l-[#4DBACC] bg-white p-6">
                <h3 className="font-semibold text-zinc-900">
                  Change order protection
                </h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Track and sign off on changes properly. No more &quot;I never
                  agreed to that.&quot;
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 border-l-4 border-l-[#4DBACC] bg-white p-6">
                <h3 className="font-semibold text-zinc-900">
                  Professional dispute documentation
                </h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Generate clear, organized documentation for disputes, liens, or
                  small claims.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 border-l-4 border-l-[#4DBACC] bg-white p-6">
                <h3 className="font-semibold text-zinc-900">
                  AI clarity and risk scanning
                </h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Get AI-assisted clarity on contracts and early warnings on
                  potential risks.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 border-l-4 border-l-[#4DBACC] bg-white p-6">
                <h3 className="font-semibold text-zinc-900">
                  More professional workflow
                </h3>
                <p className="mt-2 text-sm text-zinc-600">
                  One place for contracts, photos, and documentation. Look more
                  professional, work with less stress.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="scroll-mt-20 border-b-2 border-b-[#4DBACC]/20 px-6 py-16 sm:px-8 sm:py-20"
        >
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              Built for Real Contractor Workflows
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#2436BB] text-lg font-bold text-white">
                  1
                </div>
                <h3 className="mt-4 font-semibold text-zinc-900">
                  Create a job
                </h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Set up the job with client details and scope.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#2436BB] text-lg font-bold text-white">
                  2
                </div>
                <h3 className="mt-4 font-semibold text-zinc-900">
                  Generate a structured contract
                </h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Get a clear contract ready for client signature.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#2436BB] text-lg font-bold text-white">
                  3
                </div>
                <h3 className="mt-4 font-semibold text-zinc-900">
                  Document the work
                </h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Capture before, during, and after photos and notes.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#2436BB] text-lg font-bold text-white">
                  4
                </div>
                <h3 className="mt-4 font-semibold text-zinc-900">
                  Generate documentation instantly
                </h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Produce professional dispute or lien documentation if required.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Feature section */}
        <section
          id="features"
          className="scroll-mt-20 border-b-2 border-b-[#4DBACC]/20 bg-zinc-50/50 px-6 py-16 sm:px-8 sm:py-20"
        >
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              Everything You Need To Protect Your Work
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 border-l-4 border-l-[#4DBACC] bg-white p-6">
                <h3 className="font-semibold text-zinc-900">
                  Contracts that protect you
                </h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Generate structured contracts with clear scope and capture
                  client signatures directly on the agreement.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 border-l-4 border-l-[#4DBACC] bg-white p-6">
                <h3 className="font-semibold text-zinc-900">
                  Before / During / After job documentation
                </h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Capture timestamped photos and notes that prove the condition
                  of the property before, during, and after work.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 border-l-4 border-l-[#4DBACC] bg-white p-6">
                <h3 className="font-semibold text-zinc-900">
                  Invoices and job completion records
                </h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Generate invoices when work is complete and maintain a clear
                  record of job completion and payments.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 border-l-4 border-l-[#4DBACC] bg-white p-6">
                <h3 className="font-semibold text-zinc-900">
                  Dispute-ready documentation
                </h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Instantly generate organized documentation if a customer
                  dispute or payment issue occurs.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* When things go wrong */}
        <section
          id="when-things-go-wrong"
          className="scroll-mt-20 border-b-2 border-b-[#4DBACC]/20 px-6 py-16 sm:px-8 sm:py-20"
        >
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              When Things Go Wrong, Job Proof Has You Covered
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 border-l-4 border-l-[#4DBACC] bg-white p-6">
                <h3 className="font-semibold text-zinc-900">
                  Customer says the damage was already there
                </h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Before photos show the condition of the property before work
                  started.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 border-l-4 border-l-[#4DBACC] bg-white p-6">
                <h3 className="font-semibold text-zinc-900">
                  Scope of work becomes unclear
                </h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Your structured contract clearly documents the agreed scope.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 border-l-4 border-l-[#4DBACC] bg-white p-6">
                <h3 className="font-semibold text-zinc-900">
                  Customer claims work wasn&apos;t completed properly
                </h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Before, during, and after documentation shows exactly what
                  happened.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 border-l-4 border-l-[#4DBACC] bg-white p-6">
                <h3 className="font-semibold text-zinc-900">
                  Payment is delayed or disputed
                </h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Organized job records, signatures, and invoices support your
                  case.
                </p>
              </div>
            </div>
            <p className="mt-10 text-center text-sm font-semibold text-zinc-700">
              Designed specifically for contractors working in the real world —
              not office software.
            </p>
          </div>
        </section>

        {/* Trades section */}
        <section
          id="trades"
          className="scroll-mt-20 border-b border-zinc-200 px-6 py-16 sm:px-8 sm:py-20"
        >
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              Built for Contractors Across Multiple Trades
            </h2>
            <p className="mt-6 text-center text-zinc-600 leading-relaxed">
              Job Proof helps contractors protect their work, document jobs
              properly, and maintain professional records.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-medium text-zinc-900">
                Plumbing
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-medium text-zinc-900">
                HVAC
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-medium text-zinc-900">
                Electrical
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-medium text-zinc-900">
                Flooring
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-medium text-zinc-900">
                Renovations
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-medium text-zinc-900">
                Landscaping
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-medium text-zinc-900">
                Roofing
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-medium text-zinc-900">
                General Contracting
              </div>
            </div>
            <p className="mt-6 text-center text-sm font-semibold text-zinc-700">
              And many other contractor trades.
            </p>
          </div>
        </section>

        {/* Value */}
        <section
          id="value"
          className="scroll-mt-20 border-b border-zinc-200 bg-zinc-50/50 px-6 py-16 sm:px-8 sm:py-20"
        >
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              One Unpaid Job Can Cost More Than Years of Job Proof
            </h2>
            <p className="mt-6 text-zinc-600 leading-relaxed">
              A single disputed job can mean thousands in lost revenue, legal
              fees, and damaged reputation. Job Proof costs a fraction of that
              — and helps you avoid the dispute in the first place. Clear
              contracts and proper documentation reduce risk and give you
              confidence on every job.
            </p>
          </div>
        </section>

        {/* Pricing preview */}
        <section
          id="pricing"
          className="scroll-mt-20 border-b border-zinc-200 px-6 py-16 sm:px-8 sm:py-20"
        >
          <div className="mx-auto max-w-2xl">
            <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              Simple, Transparent Pricing
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-white p-6">
                <h3 className="font-semibold text-zinc-900">
                  Essential Protection
                </h3>
                <p className="mt-2 text-2xl font-bold text-zinc-900">$39</p>
                <p className="text-sm text-zinc-500">per month</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Built for solo contractors
                </p>
                <p className="mt-4 text-sm text-zinc-600">
                  Core contracts, job documentation, and dispute-ready records
                  designed for solo contractors.
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
                  Everything in Essential, plus advanced features, AI risk
                  scanning, and priority support.
                </p>
                <p className="mt-2 text-xs text-zinc-400">
                  Less than the cost of one service call.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Early access + form */}
        <section
          id="early-access"
          className="scroll-mt-20 px-6 py-16 sm:px-8 sm:py-20"
        >
          <div className="mx-auto max-w-2xl">
            <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              Join the Founding Members List
            </h2>
            <p className="mt-6 text-center text-zinc-600 leading-relaxed">
              Ontario contractors can request early access and help shape Job
              Proof before launch. We&apos;re building this with real contractors
              — your feedback matters.
            </p>

            <form
              className="mt-12 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"
              onSubmit={handleSubmit}
            >
              <h3 className="text-lg font-semibold text-zinc-900">
                Request Early Access
              </h3>
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
