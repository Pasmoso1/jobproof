"use server";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { verifyFollowUpAccess } from "@/lib/quote-requests/follow-up-access";
import { generateFollowUpQuestions } from "@/lib/quote-requests/follow-up-ai";
import type { FollowUpQuestion } from "@/lib/quote-requests/follow-up-types";
import { isFollowUpQuestionType } from "@/lib/quote-requests/follow-up-types";

export type GenerateFollowUpQuestionsActionResult =
  | { success: true; questions: FollowUpQuestion[]; usedFallback: boolean }
  | { success: false; error: string };

export type SaveFollowUpAnswerActionResult =
  | { success: true }
  | { success: false; error: string };

export async function generateFollowUpQuestionsAction(
  slug: string,
  requestId: string,
  token: string
): Promise<GenerateFollowUpQuestionsActionResult> {
  const access = await verifyFollowUpAccess(slug, requestId, token);
  if (!access) {
    return { success: false, error: "This follow-up session is not available." };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { success: false, error: "Unable to prepare questions right now." };
  }

  const { data: attachments } = await admin
    .from("quote_request_attachments")
    .select("file_path")
    .eq("quote_request_id", access.requestId)
    .order("created_at", { ascending: true });

  const result = await generateFollowUpQuestions(admin, {
    contractorId: access.contractorId,
    projectType: access.projectType,
    description: access.description,
    attachmentPaths: (attachments ?? []).map((a) => String(a.file_path)),
  });

  return {
    success: true,
    questions: result.questions,
    usedFallback: result.usedFallback,
  };
}

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
): Promise<SaveFollowUpAnswerActionResult> {
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

  const admin = createServiceRoleClient();
  if (!admin) {
    return { success: false, error: "Unable to save your answer right now." };
  }

  const answer =
    input.answer == null || input.answer.trim() === "" ? null : input.answer.trim();

  const { error } = await admin.from("quote_request_followup_answers").upsert(
    {
      quote_request_id: access.requestId,
      question,
      answer,
      question_type: questionType,
      display_order: displayOrder,
    },
    { onConflict: "quote_request_id,display_order" }
  );

  if (error) {
    console.error("[saveFollowUpAnswerAction]", error);
    return { success: false, error: "Could not save your answer. Please try again." };
  }

  return { success: true };
}
