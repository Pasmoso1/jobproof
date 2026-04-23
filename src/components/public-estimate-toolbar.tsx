"use client";

export function PublicEstimateToolbar({
  token,
  hasPdf,
}: {
  token: string;
  hasPdf: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      {hasPdf ? (
        <a
          href={`/estimate/${token}/pdf`}
          className="inline-flex rounded-lg bg-[#2436BB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2"
        >
          Download PDF
        </a>
      ) : null}
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2"
      >
        Print
      </button>
    </div>
  );
}
