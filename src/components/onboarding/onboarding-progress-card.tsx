import type { ContractorOnboardingProgress } from "@/lib/contractor-onboarding-progress";

const STEPS: {
  key: keyof ContractorOnboardingProgress;
  label: string;
}[] = [
  { key: "hasJob", label: "Create first job" },
  { key: "hasProofUpdate", label: "Add proof update" },
  { key: "hasContractSent", label: "Send contract" },
  { key: "hasInvoiceSent", label: "Send invoice" },
];

export function OnboardingProgressCard({ progress }: { progress: ContractorOnboardingProgress }) {
  const doneCount = STEPS.filter((s) => progress[s.key]).length;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
      <h2 className="text-base font-semibold text-zinc-900">Getting started</h2>
      <p className="mt-1 text-sm text-zinc-600">
        {doneCount} of {STEPS.length} steps complete — build your first protected job timeline.
      </p>
      <ul className="mt-4 space-y-2">
        {STEPS.map((step) => {
          const done = progress[step.key];
          return (
            <li key={step.key} className="flex items-center gap-3 text-sm">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  done ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-500"
                }`}
                aria-hidden
              >
                {done ? "✓" : "·"}
              </span>
              <span className={done ? "text-zinc-700 line-through decoration-zinc-400" : "text-zinc-900"}>
                {step.label}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
