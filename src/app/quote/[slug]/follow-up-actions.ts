"use server";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { verifyFollowUpAccess } from "@/lib/quote-requests/follow-up-access";
import { getNextInterviewStep } from "@/lib/quote-requests/follow-up-interview";
import {
  MAX_FOLLOW_UP_INTERVIEW_QUESTIONS,
  type FollowUpQuestion,
  type InterviewStepResult,
  type PreviousInterviewAnswer,
} from "@/lib/quote-requests/follow-up-types";
import { isFollowUpQuestionType } from "@/lib/quote-requests/follow-up-types";

export type FollowUpInterviewActionResult =
  | ({ success: true } & InterviewStepResult)
  | { success: false; error: string };

async function loadInterviewContext(requestId: string) {
  const admin = createServiceRoleClient();
  if (!admin) return null;

  const { data: attachments } = await admin
    .from("quote_request_attachments")
    .select("file_path")
    .eq("quote_request_id", requestId)
    .order("created_at", { ascending: true });

  const { data: answers } = await admin
    .from("quote_request_followup_answers")
    .select("question, answer, question_type, display_order, library_question_id")
    .eq("quote_request_id", requestId)
    .order("display_order", { ascending: true });

  return {
    admin,
    attachmentPaths: (attachments ?? []).map((a) => String(a.file_path)),
    previousAnswers: (answers ?? []).map(
      (a): PreviousInterviewAnswer => ({
        question: String(a.question),
        answer: a.answer == null ? null : String(a.answer),
        question_type: String(a.question_type),
        display_order: Number(a.display_order),
        library_question_id: a.library_question_id
          ? String(a.library_question_id)
          : null,
      })
    ),
  };
}

export async function startFollowUpInterviewAction(
  slug: string,
  requestId: string,
  token: string
): Promise<FollowUpInterviewActionResult> {
  const access = await verifyFollowUpAccess(slug, requestId, token);
  if (!access) {
    return { success: false, error: "This follow-up session is not available." };
  }

  const ctx = await loadInterviewContext(access.requestId);
  if (!ctx) {
    return { success: false, error: "Unable to prepare questions right now." };
  }

  const step = await getNextInterviewStep(ctx.admin, {
    requestId: access.requestId,
    contractorId: access.contractorId,
    projectType: access.projectType,
    description: access.description,
    attachmentPaths: ctx.attachmentPaths,
    previousAnswers: ctx.previousAnswers,
  });

  return { success: true, ...step };
}

export async function submitFollowUpInterviewAnswerAction(
  slug: string,
  requestId: string,
  token: string,
  input: {
    question: string;
    answer: string | null;
    questionType: string;
    displayOrder: number;
    libraryQuestionId?: string | null;
    finishInterview?: boolean;
  }
): Promise<FollowUpInterviewActionResult> {
  const access = await verifyFollowUpAccess(slug, requestId, token);
  if (!access) {
    return { success: false, error: "This follow-up session is not available." };
  }

  const question = input.question.trim();
  if (!question) {
    return { success: false, error: "Question is required." };
  }

  const questionType = input.questionType.trim();
  if (!isFollowUpQuestionType(questionType)) {
    return { success: false, error: "Invalid question type." };
  }

  const displayOrder = Math.max(1, Math.floor(input.displayOrder));

  const ctx = await loadInterviewContext(access.requestId);
  if (!ctx) {
    return { success: false, error: "Unable to save your answer right now." };
  }

  const answer =
    input.answer == null || input.answer.trim() === "" ? null : input.answer.trim();

  const { error } = await ctx.admin.from("quote_request_followup_answers").upsert(
    {
      quote_request_id: access.requestId,
      question,
      answer,
      question_type: questionType,
      display_order: displayOrder,
      library_question_id: input.libraryQuestionId?.trim() || null,
    },
    { onConflict: "quote_request_id,display_order" }
  );

  if (error) {
    console.error("[submitFollowUpInterviewAnswerAction]", error);
    return { success: false, error: "Could not save your answer. Please try again." };
  }

  if (input.finishInterview || displayOrder >= MAX_FOLLOW_UP_INTERVIEW_QUESTIONS) {
    return { success: true, status: "complete", usedFallback: false };
  }

  const previousAnswers: PreviousInterviewAnswer[] = [
    ...ctx.previousAnswers.filter((a) => a.display_order !== displayOrder),
    {
      question,
      answer,
      question_type: questionType,
      display_order: displayOrder,
      library_question_id: input.libraryQuestionId?.trim() || null,
    },
  ].sort((a, b) => a.display_order - b.display_order);

  const step = await getNextInterviewStep(ctx.admin, {
    requestId: access.requestId,
    contractorId: access.contractorId,
    projectType: access.projectType,
    description: access.description,
    attachmentPaths: ctx.attachmentPaths,
    previousAnswers,
  });

  return { success: true, ...step };
}

/** @deprecated Use startFollowUpInterviewAction */
export async function generateFollowUpQuestionsAction(
  slug: string,
  requestId: string,
  token: string
): Promise<
  | { success: true; questions: FollowUpQuestion[]; usedFallback: boolean }
  | { success: false; error: string }
> {
  const result = await startFollowUpInterviewAction(slug, requestId, token);
  if (!result.success) {
    return result;
  }
  if (result.status === "complete") {
    return { success: true, questions: [], usedFallback: result.usedFallback };
  }
  return {
    success: true,
    questions: [result.question],
    usedFallback: result.usedFallback,
  };
}

/** @deprecated Use submitFollowUpInterviewAnswerAction */
export async function saveFollowUpAnswerAction(
  slug: string,
  requestId: string,
  token: string,
  input: {
    question: string;
    answer: string | null;
    questionType: string;
    displayOrder: number;
  }
): Promise<{ success: true } | { success: false; error: string }> {
  const result = await submitFollowUpInterviewAnswerAction(slug, requestId, token, {
    ...input,
    finishInterview: true,
  });
  if (!result.success) {
    return result;
  }
  return { success: true };
}
