"use client";

import { useCallback, useMemo, useState } from "react";
import {
  generateFollowUpQuestionsAction,
  saveFollowUpAnswerAction,
} from "../follow-up-actions";
import type { FollowUpQuestion } from "@/lib/quote-requests/follow-up-types";

type FlowStep = "prompt" | "loading" | "questions" | "complete" | "declined";

const INPUT_CLASS =
  "mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB] sm:text-sm";

export function QuoteFollowUpFlow({
  slug,
  requestId,
  token,
}: {
  slug: string;
  requestId: string;
  token: string;
}) {
  const [step, setStep] = useState<FlowStep>("prompt");
  const [questions, setQuestions] = useState<FollowUpQuestion[]>([]);
  const [usedFallback, setUsedFallback] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checkboxDraft, setCheckboxDraft] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const currentQuestion = questions[currentIndex] ?? null;
  const totalQuestions = questions.length;
  const progress = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

  const currentAnswer = useMemo(() => {
    if (!currentQuestion) return "";
    if (currentQuestion.question_type === "checkbox") {
      return (checkboxDraft[currentQuestion.id] ?? []).join("|");
    }
    return answers[currentQuestion.id] ?? "";
  }, [answers, checkboxDraft, currentQuestion]);

  const persistAnswer = useCallback(
    async (question: FollowUpQuestion, answer: string | null) => {
      const result = await saveFollowUpAnswerAction(slug, requestId, token, {
        question: question.question,
        answer,
        questionType: question.question_type,
        displayOrder: question.display_order,
      });
      if (!result.success) {
        throw new Error(result.error);
      }
    },
    [requestId, slug, token]
  );

  async function startQuestions() {
    setStep("loading");
    setError(null);
    try {
      const result = await generateFollowUpQuestionsAction(slug, requestId, token);
      if (!result.success) {
        setError(result.error);
        setStep("prompt");
        return;
      }
      setQuestions(result.questions);
      setUsedFallback(result.usedFallback);
      setCurrentIndex(0);
      setStep("questions");
    } catch {
      setError("We couldn't prepare personalized questions right now.");
      setStep("prompt");
    }
  }

  async function goNext(saveValue: string | null) {
    if (!currentQuestion) return;
    setSaving(true);
    setError(null);
    try {
      await persistAnswer(currentQuestion, saveValue);
      if (currentIndex >= totalQuestions - 1) {
        setStep("complete");
        return;
      }
      setCurrentIndex((i) => i + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your answer.");
    } finally {
      setSaving(false);
    }
  }

  function handleNext() {
    if (!currentQuestion) return;
    const value =
      currentQuestion.question_type === "checkbox"
        ? (checkboxDraft[currentQuestion.id] ?? []).join("|")
        : answers[currentQuestion.id]?.trim() ?? "";
    void goNext(value || null);
  }

  function handleSkip() {
    if (!currentQuestion) return;
    void goNext(null);
  }

  function handlePrevious() {
    setError(null);
    setCurrentIndex((i) => Math.max(0, i - 1));
  }

  function setAnswerForCurrent(value: string) {
    if (!currentQuestion) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
  }

  function toggleCheckbox(option: string) {
    if (!currentQuestion) return;
    setCheckboxDraft((prev) => {
      const existing = prev[currentQuestion.id] ?? [];
      const next = existing.includes(option)
        ? existing.filter((o) => o !== option)
        : [...existing, option];
      return { ...prev, [currentQuestion.id]: next };
    });
  }

  if (step === "declined") {
    return null;
  }

  if (step === "complete") {
    return (
      <section className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-5">
        <h2 className="text-base font-semibold text-emerald-950">Thanks for the extra details</h2>
        <p className="mt-2 text-sm text-emerald-900">
          Your answers have been shared with the contractor along with your original quote request.
        </p>
      </section>
    );
  }

  if (step === "prompt") {
    return (
      <section className="mt-8 rounded-lg border border-[#2436BB]/20 bg-[#2436BB]/5 p-5">
        <h2 className="text-base font-semibold text-zinc-900">Help us improve your quote</h2>
        <p className="mt-2 text-sm text-zinc-700">
          You&apos;ve already submitted your request. Answering a few additional questions may help
          your contractor prepare a more accurate quote before contacting you. This step is
          completely optional.
        </p>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void startQuestions()}
            className="rounded-lg bg-[#2436BB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1c2a96]"
          >
            Answer a few questions
          </button>
          <button
            type="button"
            onClick={() => setStep("declined")}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            No thanks
          </button>
        </div>
      </section>
    );
  }

  if (step === "loading") {
    return (
      <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
        <p className="text-sm font-medium text-zinc-900">Preparing your personalized questions…</p>
        <p className="mt-2 text-sm text-zinc-600">This usually takes a few seconds.</p>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-zinc-200">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-[#2436BB]" />
        </div>
      </section>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  return (
    <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
      {usedFallback ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          We couldn&apos;t prepare personalized questions right now, but your quote request has
          already been submitted. Here are a few optional questions that may still help.
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3 text-sm text-zinc-600">
        <span>
          Question {currentIndex + 1} of {totalQuestions}
        </span>
        <span>About 2 minutes</span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-200">
        <div
          className="h-full rounded-full bg-[#2436BB] transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <h2 className="mt-5 text-base font-semibold text-zinc-900">{currentQuestion.question}</h2>
      <p className="mt-1 text-xs text-zinc-500">Optional — you can skip any question.</p>

      <div className="mt-4">
        {currentQuestion.question_type === "short_text" ? (
          <textarea
            rows={3}
            value={currentAnswer}
            onChange={(e) => setAnswerForCurrent(e.target.value)}
            className={INPUT_CLASS}
            placeholder="Your answer (optional)"
          />
        ) : null}

        {currentQuestion.question_type === "number" ? (
          <input
            type="number"
            value={currentAnswer}
            onChange={(e) => setAnswerForCurrent(e.target.value)}
            className={INPUT_CLASS}
            placeholder="Enter a number (optional)"
          />
        ) : null}

        {currentQuestion.question_type === "date" ? (
          <input
            type="date"
            value={currentAnswer}
            onChange={(e) => setAnswerForCurrent(e.target.value)}
            className={INPUT_CLASS}
          />
        ) : null}

        {currentQuestion.question_type === "yes_no" ? (
          <div className="mt-2 flex gap-3">
            {["Yes", "No"].map((option) => (
              <label
                key={option}
                className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-3 py-2.5 text-sm font-medium ${
                  currentAnswer === option
                    ? "border-[#2436BB] bg-[#2436BB]/5 text-[#2436BB]"
                    : "border-zinc-300 bg-white text-zinc-800"
                }`}
              >
                <input
                  type="radio"
                  name={`yes-no-${currentQuestion.id}`}
                  value={option}
                  checked={currentAnswer === option}
                  onChange={() => setAnswerForCurrent(option)}
                  className="sr-only"
                />
                {option}
              </label>
            ))}
          </div>
        ) : null}

        {currentQuestion.question_type === "multiple_choice" ? (
          <div className="mt-2 space-y-2">
            {(currentQuestion.options ?? []).map((option) => (
              <label
                key={option}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                  currentAnswer === option
                    ? "border-[#2436BB] bg-[#2436BB]/5 text-zinc-900"
                    : "border-zinc-300 bg-white text-zinc-800"
                }`}
              >
                <input
                  type="radio"
                  name={`mc-${currentQuestion.id}`}
                  value={option}
                  checked={currentAnswer === option}
                  onChange={() => setAnswerForCurrent(option)}
                  className="h-4 w-4 border-zinc-300 text-[#2436BB]"
                />
                {option}
              </label>
            ))}
          </div>
        ) : null}

        {currentQuestion.question_type === "checkbox" ? (
          <div className="mt-2 space-y-2">
            {(currentQuestion.options ?? []).map((option) => {
              const selected = (checkboxDraft[currentQuestion.id] ?? []).includes(option);
              return (
                <label
                  key={option}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                    selected
                      ? "border-[#2436BB] bg-[#2436BB]/5 text-zinc-900"
                      : "border-zinc-300 bg-white text-zinc-800"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleCheckbox(option)}
                    className="h-4 w-4 rounded border-zinc-300 text-[#2436BB]"
                  />
                  {option}
                </label>
              );
            })}
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={currentIndex === 0 || saving}
          onClick={handlePrevious}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={handleSkip}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
        >
          Skip
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={handleNext}
          className="rounded-lg bg-[#2436BB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1c2a96] disabled:opacity-60"
        >
          {saving
            ? "Saving…"
            : currentIndex >= totalQuestions - 1
              ? "Finish"
              : "Next"}
        </button>
      </div>
    </section>
  );
}
