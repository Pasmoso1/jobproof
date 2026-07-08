"use server";

import { redirect } from "next/navigation";
import {
  acceptPublicEstimateByToken,
  declinePublicEstimateByToken,
  requestEstimateChangesByToken,
  submitEstimateQuestionByToken,
} from "@/lib/estimate-public";

export async function submitAcceptEstimate(token: string) {
  const r = await acceptPublicEstimateByToken(token);
  if (!r.ok) {
    redirect(`/estimate/${encodeURIComponent(token)}?outcome=error&reason=${encodeURIComponent(r.reason)}`);
  }
  redirect(`/estimate/${encodeURIComponent(token)}?outcome=accepted`);
}

export async function submitDeclineEstimate(token: string) {
  const r = await declinePublicEstimateByToken(token);
  if (!r.ok) {
    redirect(`/estimate/${encodeURIComponent(token)}?outcome=error&reason=${encodeURIComponent(r.reason)}`);
  }
  redirect(`/estimate/${encodeURIComponent(token)}?outcome=declined`);
}

export async function submitEstimateQuestion(token: string, formData: FormData) {
  const message = String(formData.get("message") ?? "").trim();
  const r = await submitEstimateQuestionByToken(token, message);
  if (!r.ok) {
    redirect(`/estimate/${encodeURIComponent(token)}?outcome=error&reason=${encodeURIComponent(r.reason)}`);
  }
  redirect(`/estimate/${encodeURIComponent(token)}?outcome=question_sent`);
}

export async function submitEstimateChangeRequest(token: string, formData: FormData) {
  const message = String(formData.get("message") ?? "").trim();
  const r = await requestEstimateChangesByToken(token, message);
  if (!r.ok) {
    redirect(`/estimate/${encodeURIComponent(token)}?outcome=error&reason=${encodeURIComponent(r.reason)}`);
  }
  redirect(`/estimate/${encodeURIComponent(token)}?outcome=changes_requested`);
}
