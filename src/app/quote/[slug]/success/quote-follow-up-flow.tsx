"use client";

import { useMemo, useState } from "react";
import {
  startFollowUpInterviewAction,
  submitFollowUpInterviewAnswerAction,
} from "../follow-up-actions";
import type { FollowUpQuestion } from "@/lib/quote-requests/follow-up-types";
import { MAX_FOLLOW_UP_INTERVIEW_QUESTIONS } from "@/lib/quote-requests/follow-up-types";

type FlowStep = "prompt" | "loading" | "question" | "complete" | "declined";

const INPUT_CLASS =
  "mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB] sm:text-sm";

const OTHER_OPTION = "Other";

function OtherDetailsField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={INPUT_CLASS}
      placeholder="Add details (optional)"
      autoFocus
    />
  );
}

function QuestionFields({
  question,
  answer,
  checkboxValues,
  otherDetails,
  onAnswerChange,
  onCheckboxToggle,
  onOtherDetailsChange,
}: {
  question: FollowUpQuestion;
  answer: string;
  checkboxValues: string[];
  otherDetails: string;
  onAnswerChange: (value: string) => void;
  onCheckboxToggle: (option: string) => void;
  onOtherDetailsChange: (value: string) => void;
}) {
  if (question.question_type === "short_text") {
    return (
      <textarea
        rows={3}
        value={answer}
        onChange={(e) => onAnswerChange(e.target.value)}
        className={INPUT_CLASS}
        placeholder="Your answer (optional)"
      />
    );
  }

  if (question.question_type === "number") {
    return (
      <input
        type="number"
        value={answer}
        onChange={(e) => onAnswerChange(e.target.value)}
        className={INPUT_CLASS}
        placeholder="Enter a number (optional)"
      />
    );
  }

  if (question.question_type === "date") {
    return (
      <input
        type="date"
        value={answer}
        onChange={(e) => onAnswerChange(e.target.value)}
        className={INPUT_CLASS}
      />
    );
  }

  if (question.question_type === "yes_no") {
    return (
      <div className="mt-2 flex gap-3">
        {["Yes", "No"].map((option) => (
          <label
            key={option}
            className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-3 py-2.5 text-sm font-medium ${
              answer === option
                ? "border-[#2436BB] bg-[#2436BB]/5 text-[#2436BB]"
                : "border-zinc-300 bg-white text-zinc-800"
            }`}
          >
            <input
              type="radio"
              name={`yes-no-${question.id}`}
              value={option}
              checked={answer === option}
              onChange={() => onAnswerChange(option)}
              className="sr-only"
            />
            {option}
          </label>
        ))}
      </div>
    );
  }

  if (question.question_type === "multiple_choice") {
    return (
      <div className="mt-2 space-y-2">
        {(question.options ?? []).map((option) => (
          <label
            key={option}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${
              answer === option
                ? "border-[#2436BB] bg-[#2436BB]/5 text-zinc-900"
                : "border-zinc-300 bg-white text-zinc-800"
            }`}
          >
            <input
              type="radio"
              name={`mc-${question.id}`}
              value={option}
              checked={answer === option}
              onChange={() => onAnswerChange(option)}
              className="h-4 w-4 border-zinc-300 text-[#2436BB]"
            />
            {option}
          </label>
        ))}
        {answer === OTHER_OPTION ? (
          <OtherDetailsField value={otherDetails} onChange={onOtherDetailsChange} />
        ) : null}
      </div>
    );
  }

  if (question.question_type === "checkbox") {
    return (
      <div className="mt-2 space-y-2">
        {(question.options ?? []).map((option) => {
          const selected = checkboxValues.includes(option);
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
                onChange={() => onCheckboxToggle(option)}
                className="h-4 w-4 rounded border-zinc-300 text-[#2436BB]"
              />
              {option}
            </label>
          );
        })}
        {checkboxValues.includes(OTHER_OPTION) ? (
          <OtherDetailsField value={otherDetails} onChange={onOtherDetailsChange} />
        ) : null}
      </div>
    );
  }

  return null;
}

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
  const [currentQuestion, setCurrentQuestion] = useState<FollowUpQuestion | null>(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [usedFallback, setUsedFallback] = useState(false);
  const [answer, setAnswer] = useState("");
  const [checkboxValues, setCheckboxValues] = useState<string[]>([]);
  const [otherDetails, setOtherDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const progress =
    questionNumber > 0
      ? Math.min(100, (questionNumber / MAX_FOLLOW_UP_INTERVIEW_QUESTIONS) * 100)
      : 0;

  const currentAnswer = useMemo(() => {
    const details = otherDetails.trim();
    const withDetails = (option: string) =>
      option === OTHER_OPTION && details ? `${OTHER_OPTION}: ${details}` : option;

    if (currentQuestion?.question_type === "checkbox") {
      return checkboxValues.map(withDetails).join("|");
    }
    if (currentQuestion?.question_type === "multiple_choice") {
      return answer ? withDetails(answer) : answer;
    }
    return answer;
  }, [answer, checkboxValues, otherDetails, currentQuestion]);

  function resetAnswerState() {
    setAnswer("");
    setCheckboxValues([]);
    setOtherDetails("");
  }

  function applyQuestionResult(
    result: Extract<
      Awaited<ReturnType<typeof startFollowUpInterviewAction>>,
      { success: true }
    >
  ) {
    if (result.status === "complete") {
      setStep("complete");
      return;
    }
    setCurrentQuestion(result.question);
    setQuestionNumber(result.questionNumber);
    setUsedFallback(result.usedFallback);
    resetAnswerState();
    setStep("question");
  }

  async function startInterview() {
    setStep("loading");
    setError(null);
    try {
      const result = await startFollowUpInterviewAction(slug, requestId, token);
      if (!result.success) {
        setError(result.error);
        setStep("prompt");
        return;
      }
      applyQuestionResult(result);
    } catch {
      setError("We couldn't prepare your first question right now.");
      setStep("prompt");
    }
  }

  async function submitAnswer(options: {
    answerValue: string | null;
    finishInterview?: boolean;
  }) {
    if (!currentQuestion) return;
    setSaving(true);
    setError(null);
    if (!options.finishInterview) {
      setStep("loading");
    }
    try {
      const result = await submitFollowUpInterviewAnswerAction(slug, requestId, token, {
        question: currentQuestion.question,
        answer: options.answerValue,
        questionType: currentQuestion.question_type,
        displayOrder: currentQuestion.display_order,
        libraryQuestionId: currentQuestion.library_question_id,
        finishInterview: options.finishInterview,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.status === "complete") {
        setStep("complete");
        return;
      }
      applyQuestionResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your answer.");
      setStep("question");
    } finally {
      setSaving(false);
    }
  }

  function handleNext() {
    const value = currentAnswer.trim() || null;
    void submitAnswer({ answerValue: value });
  }

  function handleSkipQuestion() {
    void submitAnswer({ answerValue: null });
  }

  function handleFinish() {
    const value = currentAnswer.trim() || null;
    void submitAnswer({ answerValue: value, finishInterview: true });
  }

  function handleSkipRemaining() {
    void submitAnswer({ answerValue: null, finishInterview: true });
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
            onClick={() => void startInterview()}
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
        <p className="text-sm font-medium text-zinc-900">
          {questionNumber === 0
            ? "Preparing your first question…"
            : "Choosing the next question…"}
        </p>
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
          We couldn&apos;t personalize every question right now, but your quote request has already
          been submitted.
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3 text-sm text-zinc-600">
        <span>
          Question {questionNumber} of up to {MAX_FOLLOW_UP_INTERVIEW_QUESTIONS}
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
        <QuestionFields
          question={currentQuestion}
          answer={answer}
          checkboxValues={checkboxValues}
          otherDetails={otherDetails}
          onAnswerChange={setAnswer}
          onCheckboxToggle={(option) => {
            setCheckboxValues((prev) =>
              prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
            );
          }}
          onOtherDetailsChange={setOtherDetails}
        />
      </div>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={handleNext}
          className="rounded-lg bg-[#2436BB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1c2a96] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Next"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={handleSkipQuestion}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
        >
          Skip this question
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={handleFinish}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
        >
          Finish
        </button>
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={handleSkipRemaining}
        className="mt-3 text-sm text-zinc-500 underline hover:text-zinc-700 disabled:opacity-50"
      >
        Skip remaining questions
      </button>
    </section>
  );
}
