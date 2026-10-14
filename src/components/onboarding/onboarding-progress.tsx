const STEPS = ["Choose your plan", "Business setup"] as const;

export function OnboardingProgress({ step }: { step: 1 | 2 }) {
  const label = `Step ${step} of ${STEPS.length} — ${STEPS[step - 1]}`;
  return (
    <div className="mb-4" role="group" aria-label="Onboarding progress">
      <p className="text-xs font-semibold text-[#2436BB]">{label}</p>
      <div className="mt-2 flex gap-1.5" aria-hidden="true">
        {STEPS.map((name, index) => (
          <span
            key={name}
            className={`h-1.5 flex-1 rounded-full ${index < step ? "bg-[#2436BB]" : "bg-zinc-200"}`}
          />
        ))}
      </div>
    </div>
  );
}
