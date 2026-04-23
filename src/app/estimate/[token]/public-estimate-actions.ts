"use server";

import { redirect } from "next/navigation";
import {
  acceptPublicEstimateByToken,
  declinePublicEstimateByToken,
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
