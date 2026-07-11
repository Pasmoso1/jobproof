"use client";

import { useState, useTransition, type FormEvent } from "react";
import { submitSupportTicket } from "../actions";

function detectBrowser(): string {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "Edge";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
  if (/Firefox\//.test(ua)) return "Firefox";
  return "Other";
}

function detectOs(): string {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS X/i.test(ua)) return "macOS";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Other";
}

function collectClientMetadata(): Record<string, string> {
  return {
    current_page: window.location.href,
    browser: detectBrowser(),
    operating_system: detectOs(),
    screen_size: `${window.screen.width}x${window.screen.height}`,
    user_agent: navigator.userAgent,
  };
}

export function SupportContactForm({
  defaultName,
  defaultEmail,
}: {
  defaultName: string;
  defaultEmail: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const meta = collectClientMetadata();
    for (const [key, value] of Object.entries(meta)) {
      formData.set(key, value);
    }
    startTransition(async () => {
      const result = await submitSupportTicket(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setDone(true);
      e.currentTarget.reset();
    });
  }

  if (done) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-5 text-sm text-green-900">
        <p className="font-semibold">Message received</p>
        <p className="mt-1">
          Thanks for reaching out. We review support messages regularly and will follow up by email
          when needed.
        </p>
        <button
          type="button"
          className="mt-3 text-sm font-medium text-[#2436BB] hover:underline"
          onClick={() => setDone(false)}
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div>
        <label htmlFor="support-name" className="block text-sm font-medium text-zinc-800">
          Name
        </label>
        <input
          id="support-name"
          name="name"
          required
          defaultValue={defaultName}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2436BB]"
        />
      </div>
      <div>
        <label htmlFor="support-email" className="block text-sm font-medium text-zinc-800">
          Email
        </label>
        <input
          id="support-email"
          name="email"
          type="email"
          required
          defaultValue={defaultEmail}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2436BB]"
        />
      </div>
      <div>
        <label htmlFor="support-subject" className="block text-sm font-medium text-zinc-800">
          Subject
        </label>
        <input
          id="support-subject"
          name="subject"
          required
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2436BB]"
        />
      </div>
      <div>
        <label htmlFor="support-category" className="block text-sm font-medium text-zinc-800">
          Category
        </label>
        <select
          id="support-category"
          name="category"
          required
          defaultValue="general_question"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2436BB]"
        >
          <option value="general_question">General Question</option>
          <option value="need_help">Need Help</option>
          <option value="bug_report">Bug Report</option>
          <option value="feature_suggestion">Feature Suggestion</option>
          <option value="billing">Billing</option>
        </select>
      </div>
      <div>
        <label htmlFor="support-message" className="block text-sm font-medium text-zinc-800">
          Message
        </label>
        <textarea
          id="support-message"
          name="message"
          required
          rows={6}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2436BB]"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[#2436BB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1c2a96] disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
