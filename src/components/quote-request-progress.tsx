import type {
  QuoteProgress,
  QuoteProgressStep,
  QuoteProgressStepState,
} from "@/lib/quote-requests/quote-progress";

function stateLabel(state: QuoteProgressStepState): string {
  switch (state) {
    case "complete":
      return "Complete";
    case "current":
      return "Current";
    case "not_started":
      return "Not started";
  }
}

function StepIndicator({ step }: { step: QuoteProgressStep }) {
  const isSuccess = step.variant === "success";
  const isClosed = step.variant === "closed";

  let circleClass =
    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold";
  if (step.state === "complete") {
    if (isSuccess) {
      circleClass += " border-emerald-600 bg-emerald-600 text-white";
    } else if (isClosed) {
      circleClass += " border-zinc-400 bg-zinc-100 text-zinc-600";
    } else {
      circleClass += " border-[#2436BB] bg-[#2436BB] text-white";
    }
  } else if (step.state === "current") {
    circleClass += " border-[#2436BB] bg-white text-[#2436BB]";
  } else {
    circleClass += " border-zinc-300 bg-white text-zinc-400";
  }

  return (
    <span className={circleClass} aria-hidden>
      {step.state === "complete" ? (
        isClosed ? (
          "—"
        ) : (
          <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path
              d="M2 6l3 3 5-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )
      ) : (
        <span className="h-2 w-2 rounded-full bg-current opacity-80" />
      )}
    </span>
  );
}

function StepContent({ step }: { step: QuoteProgressStep }) {
  const titleClass =
    step.variant === "success"
      ? "font-medium text-emerald-900"
      : step.variant === "closed"
        ? "font-medium text-zinc-600"
        : step.state === "current"
          ? "font-semibold text-zinc-900"
          : step.state === "complete"
            ? "font-medium text-zinc-800"
            : "font-medium text-zinc-500";

  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className={`text-sm ${titleClass}`}>{step.label}</p>
        <span className="sr-only">{stateLabel(step.state)}</span>
        {step.state === "current" ? (
          <span className="rounded-full bg-[#2436BB]/10 px-2 py-0.5 text-xs font-medium text-[#2436BB]">
            Current
          </span>
        ) : null}
      </div>
      {step.description && step.state !== "complete" ? (
        <p className="mt-0.5 text-xs text-zinc-500">{step.description}</p>
      ) : null}
    </div>
  );
}

function HorizontalStepper({ steps }: { steps: QuoteProgressStep[] }) {
  return (
    <ol className="hidden items-start gap-0 md:flex">
      {steps.map((step, index) => (
        <li
          key={step.key}
          className={`flex min-w-0 flex-1 flex-col items-center ${index === 0 ? "" : ""}`}
        >
          <div className="flex w-full items-center">
            {index > 0 ? (
              <div
                className={`h-0.5 flex-1 ${
                  steps[index - 1]?.state === "complete"
                    ? "bg-[#2436BB]"
                    : "bg-zinc-200"
                }`}
                aria-hidden
              />
            ) : (
              <div className="flex-1" aria-hidden />
            )}
            <StepIndicator step={step} />
            {index < steps.length - 1 ? (
              <div
                className={`h-0.5 flex-1 ${
                  step.state === "complete" ? "bg-[#2436BB]" : "bg-zinc-200"
                }`}
                aria-hidden
              />
            ) : (
              <div className="flex-1" aria-hidden />
            )}
          </div>
          <p
            className={`mt-2 max-w-[5.5rem] text-center text-xs leading-tight ${
              step.state === "not_started" ? "text-zinc-400" : "text-zinc-700"
            }`}
          >
            {step.label}
          </p>
        </li>
      ))}
    </ol>
  );
}

function VerticalStepper({ steps }: { steps: QuoteProgressStep[] }) {
  return (
    <ol className="space-y-0 md:hidden">
      {steps.map((step, index) => (
        <li key={step.key} className="flex gap-3">
          <div className="flex flex-col items-center">
            <StepIndicator step={step} />
            {index < steps.length - 1 ? (
              <div
                className={`my-1 w-0.5 flex-1 min-h-[1.25rem] ${
                  step.state === "complete" ? "bg-[#2436BB]" : "bg-zinc-200"
                }`}
                aria-hidden
              />
            ) : null}
          </div>
          <div className={`pb-4 ${index === steps.length - 1 ? "pb-0" : ""}`}>
            <StepContent step={step} />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function QuoteRequestProgress({ progress }: { progress: QuoteProgress }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-zinc-900">Quote Progress</h2>
      <p className="mt-0.5 text-xs text-zinc-500">
        Where this request stands in your quote workflow.
      </p>
      <div className="mt-4">
        <HorizontalStepper steps={progress.steps} />
        <VerticalStepper steps={progress.steps} />
      </div>
    </section>
  );
}
