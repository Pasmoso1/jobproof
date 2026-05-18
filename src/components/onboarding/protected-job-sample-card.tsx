import Link from "next/link";

const SAMPLE_TIMELINE = [
  { label: "Estimate sent", done: true },
  { label: "Contract signed", done: true },
  { label: "Before photos uploaded", done: true },
  { label: "Change order approved", done: true },
  { label: "Invoice sent", done: true },
  { label: "Payment recorded", done: true },
  { label: "Proof report ready", done: true },
] as const;

export function ProtectedJobSampleCard({
  id = "protected-job-sample",
  showCreateCta = true,
}: {
  id?: string;
  showCreateCta?: boolean;
}) {
  return (
    <div
      id={id}
      className="rounded-xl border border-[#2436BB]/20 bg-gradient-to-b from-[#2436BB]/5 to-white p-5 sm:p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[#2436BB]">
        Sample protected job
      </p>
      <h3 className="mt-1 text-lg font-semibold text-zinc-900">
        Kitchen Renovation — Protected job example
      </h3>
      <ul className="mt-4 space-y-2" aria-label="Sample job protection timeline">
        {SAMPLE_TIMELINE.map((step) => (
          <li key={step.label} className="flex items-start gap-3 text-sm">
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-800"
              aria-hidden
            >
              ✓
            </span>
            <span className="text-zinc-800">{step.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-zinc-600">
        This is what a protected job looks like when everything is documented in one place.
      </p>
      {showCreateCta ? (
        <Link
          href="/jobs/create"
          className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#2436BB] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2 sm:w-auto"
        >
          Create my first protected job
        </Link>
      ) : null}
    </div>
  );
}
