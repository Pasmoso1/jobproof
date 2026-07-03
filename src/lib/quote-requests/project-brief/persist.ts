import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { QUOTE_REQUEST_STORAGE_BUCKET } from "@/lib/quote-requests/constants";
import type { PreviousInterviewAnswer } from "@/lib/quote-requests/follow-up-types";
import { buildUnifiedUnderstandingBlock } from "@/lib/quote-requests/interview-context";
import { classifyCustomerProblem } from "@/lib/quote-requests/problem-classification";
import {
  SCOPE_FIT_BADGE_LABEL,
  isScopeFit,
  type ScopeFit,
} from "@/lib/quote-requests/scope-assessment";
import { generateProjectBriefWithAi } from "@/lib/quote-requests/project-brief/generate";
import { buildFallbackProjectBrief } from "@/lib/quote-requests/project-brief/fallback";
import type {
  ProjectBrief,
  ProjectBriefTrigger,
} from "@/lib/quote-requests/project-brief/types";
import { parseProjectBrief } from "@/lib/quote-requests/project-brief/types";

const MAX_BRIEF_PHOTOS = 4;

export type ProjectBriefContext = {
  requestId: string;
  customerName: string;
  projectType: string;
  description: string;
  isUrgent: boolean;
  photoCount: number;
  attachmentPaths: string[];
  previousAnswers: PreviousInterviewAnswer[];
  interviewCompleted: boolean;
  scopeFit: string | null;
  scopeReason: string | null;
  customerProblemLabel: string | null;
  existingBrief: ProjectBrief | null;
  trigger: ProjectBriefTrigger;
};

export function computeProjectBriefInputHash(context: ProjectBriefContext): string {
  const payload = JSON.stringify({
    description: context.description.trim(),
    projectType: context.projectType.trim(),
    isUrgent: context.isUrgent,
    photoCount: context.photoCount,
    answers: context.previousAnswers.map((a) => ({
      q: a.question,
      a: a.answer,
      order: a.display_order,
    })),
    interviewCompleted: context.interviewCompleted,
    scopeFit: context.scopeFit,
    scopeReason: context.scopeReason,
    customerProblemLabel: context.customerProblemLabel,
  });
  return createHash("sha256").update(payload).digest("hex");
}

async function signAttachmentUrls(
  admin: SupabaseClient,
  attachmentPaths: string[]
): Promise<string[]> {
  const urls: string[] = [];
  for (const filePath of attachmentPaths.slice(0, MAX_BRIEF_PHOTOS)) {
    const { data } = await admin.storage
      .from(QUOTE_REQUEST_STORAGE_BUCKET)
      .createSignedUrl(filePath, 3600);
    if (data?.signedUrl) {
      urls.push(data.signedUrl);
    }
  }
  return urls;
}

export async function loadProjectBriefContext(
  admin: SupabaseClient,
  requestId: string,
  trigger: ProjectBriefTrigger,
  interviewCompleted: boolean
): Promise<ProjectBriefContext | null> {
  const { data: request, error } = await admin
    .from("quote_requests")
    .select(
      "id, customer_name, project_type, description, is_urgent, project_brief, ai_scope_fit, ai_scope_reason, ai_customer_problem_label"
    )
    .eq("id", requestId)
    .maybeSingle();

  if (error || !request) {
    console.error("[project-brief] load request failed", error);
    return null;
  }

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

  const attachmentPaths = (attachments ?? []).map((a) => String(a.file_path));
  const previousAnswers: PreviousInterviewAnswer[] = (answers ?? []).map((a) => ({
    question: String(a.question),
    answer: a.answer == null ? null : String(a.answer),
    question_type: String(a.question_type),
    display_order: Number(a.display_order),
    library_question_id: a.library_question_id ? String(a.library_question_id) : null,
  }));

  return {
    requestId,
    customerName: String(request.customer_name),
    projectType: String(request.project_type),
    description: String(request.description),
    isUrgent: Boolean(request.is_urgent),
    photoCount: attachmentPaths.length,
    attachmentPaths,
    previousAnswers,
    interviewCompleted,
    scopeFit: request.ai_scope_fit ? String(request.ai_scope_fit) : null,
    scopeReason: request.ai_scope_reason ? String(request.ai_scope_reason) : null,
    customerProblemLabel: request.ai_customer_problem_label
      ? String(request.ai_customer_problem_label)
      : null,
    existingBrief: parseProjectBrief(request.project_brief),
    trigger,
  };
}

export async function generateProjectBriefFromContext(
  admin: SupabaseClient,
  context: ProjectBriefContext
): Promise<ProjectBrief> {
  const photoUrls = await signAttachmentUrls(admin, context.attachmentPaths);
  const customerProblem = classifyCustomerProblem(context.projectType, context.description);
  const understanding = buildUnifiedUnderstandingBlock({
    description: context.description,
    projectType: context.projectType,
    isUrgent: context.isUrgent,
    photoCount: context.photoCount,
    previousAnswers: context.previousAnswers,
    customerProblem,
  });

  const scopeFitLabel =
    context.scopeFit && isScopeFit(context.scopeFit)
      ? SCOPE_FIT_BADGE_LABEL[context.scopeFit as ScopeFit]
      : null;

  const aiBrief = await generateProjectBriefWithAi({
    context,
    understanding,
    photoUrls,
    scopeFitLabel,
    customerProblemLabel: context.customerProblemLabel ?? customerProblem.label,
  });

  if (aiBrief) return aiBrief;

  return buildFallbackProjectBrief(context, scopeFitLabel, customerProblem.label);
}

export async function saveProjectBrief(
  admin: SupabaseClient,
  requestId: string,
  brief: ProjectBrief,
  inputHash: string
): Promise<void> {
  const { error } = await admin
    .from("quote_requests")
    .update({
      project_brief: brief,
      project_brief_generated_at: brief.generatedAt,
      project_brief_input_hash: inputHash,
    })
    .eq("id", requestId);

  if (error) {
    console.error("[project-brief] save failed", { requestId, message: error.message });
  }
}

/**
 * Generate and persist a Project Brief when source inputs have changed.
 * Safe to call from multiple triggers — skips if hash matches stored hash.
 */
export async function maybeGenerateProjectBrief(
  admin: SupabaseClient,
  requestId: string,
  trigger: ProjectBriefTrigger,
  interviewCompleted = false
): Promise<ProjectBrief | null> {
  const context = await loadProjectBriefContext(admin, requestId, trigger, interviewCompleted);
  if (!context) return null;

  const inputHash = computeProjectBriefInputHash(context);

  const { data: existing } = await admin
    .from("quote_requests")
    .select("project_brief_input_hash, project_brief")
    .eq("id", requestId)
    .maybeSingle();

  if (
    existing?.project_brief_input_hash === inputHash &&
    parseProjectBrief(existing.project_brief)
  ) {
    return parseProjectBrief(existing.project_brief);
  }

  const brief = await generateProjectBriefFromContext(admin, context);
  await saveProjectBrief(admin, requestId, brief, inputHash);
  return brief;
}
