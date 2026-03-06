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
    <div className="min-h-screen bg-zinc-50 font-sans">
      <main className="mx-auto max-w-2xl px-6 py-16 sm:px-8 sm:py-24">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Protect Every Job. Get Paid. Stay Protected.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-zinc-600">
            Job Proof helps contractors create contracts, document jobs with
            before/during/after photos, store job documentation, and generate
            dispute documentation when needed.
          </p>
        </div>

        <form
          className="mt-12 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"
          onSubmit={handleSubmit}
        >
          <h2 className="text-lg font-semibold text-zinc-900">
            Request Early Access
          </h2>
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
            className="mt-6 w-full rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto sm:px-8"
          >
            {status === "loading" ? "Submitting..." : "Request Early Access"}
          </button>
        </form>
      </main>
    </div>
  );
}
