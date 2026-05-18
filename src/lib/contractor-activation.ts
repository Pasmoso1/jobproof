import { createClient } from "@/lib/supabase/server";

const SENT_INVOICE_STATUSES = ["sent", "paid", "overdue", "partially_paid"] as const;

export type ContractorActivationState = {
  hasJob: boolean;
  hasProofUpdate: boolean;
  hasContractSent: boolean;
  hasInvoiceSent: boolean;
  hasPaymentRecorded: boolean;
  onboardingStartedAt: string | null;
  firstJobCreatedAt: string | null;
  firstJobUpdateAt: string | null;
  firstContractSentAt: string | null;
  firstInvoiceSentAt: string | null;
  firstPaymentRecordedAt: string | null;
  onboardingCompletedAt: string | null;
};

/**
 * Onboarding complete for analytics / lifecycle: job + proof + (contract OR invoice).
 */
export function isOnboardingComplete(state: Pick<
  ContractorActivationState,
  "hasJob" | "hasProofUpdate" | "hasContractSent" | "hasInvoiceSent"
>): boolean {
  return (
    state.hasJob &&
    state.hasProofUpdate &&
    (state.hasContractSent || state.hasInvoiceSent)
  );
}

/**
 * Progress card: 4 steps (job, proof, contract, invoice).
 */
export function getOnboardingCompletionPercent(
  state: Pick<
    ContractorActivationState,
    "hasJob" | "hasProofUpdate" | "hasContractSent" | "hasInvoiceSent"
  >
): number {
  const steps = [
    state.hasJob,
    state.hasProofUpdate,
    state.hasContractSent,
    state.hasInvoiceSent,
  ];
  const done = steps.filter(Boolean).length;
  return Math.round((done / steps.length) * 100);
}

/** UI card hidden when all four checklist steps are done. */
export function isOnboardingProgressCardComplete(
  state: Pick<
    ContractorActivationState,
    "hasJob" | "hasProofUpdate" | "hasContractSent" | "hasInvoiceSent"
  >
): boolean {
  return (
    state.hasJob &&
    state.hasProofUpdate &&
    state.hasContractSent &&
    state.hasInvoiceSent
  );
}

export async function getContractorActivationState(
  profileId: string
): Promise<ContractorActivationState> {
  const supabase = await createClient();

  const { data: profileRow } = await supabase
    .from("profiles")
    .select(
      "onboarding_started_at, first_job_created_at, first_job_update_at, first_contract_sent_at, first_invoice_sent_at, first_payment_recorded_at, onboarding_completed_at"
    )
    .eq("id", profileId)
    .maybeSingle();

  const { count: jobCount } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId);

  const hasJob = (jobCount ?? 0) > 0;
  if (!hasJob) {
    return {
      hasJob: false,
      hasProofUpdate: false,
      hasContractSent: false,
      hasInvoiceSent: false,
      hasPaymentRecorded: false,
      onboardingStartedAt: profileRow?.onboarding_started_at ?? null,
      firstJobCreatedAt: profileRow?.first_job_created_at ?? null,
      firstJobUpdateAt: profileRow?.first_job_update_at ?? null,
      firstContractSentAt: profileRow?.first_contract_sent_at ?? null,
      firstInvoiceSentAt: profileRow?.first_invoice_sent_at ?? null,
      firstPaymentRecordedAt: profileRow?.first_payment_recorded_at ?? null,
      onboardingCompletedAt: profileRow?.onboarding_completed_at ?? null,
    };
  }

  const { data: jobRows } = await supabase
    .from("jobs")
    .select("id, contract_status")
    .eq("profile_id", profileId);

  const jobIds = (jobRows ?? []).map((j) => j.id as string);
  const hasContractSent = (jobRows ?? []).some((j) => {
    const st = String(j.contract_status ?? "");
    return st === "pending" || st === "signed";
  });

  let hasProofUpdate = false;
  if (jobIds.length > 0) {
    const { count: updateCount } = await supabase
      .from("job_updates")
      .select("id", { count: "exact", head: true })
      .in("job_id", jobIds);
    hasProofUpdate = (updateCount ?? 0) > 0;
  }

  const { count: invoiceCount } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .in("status", [...SENT_INVOICE_STATUSES]);

  const { count: paymentCount } = await supabase
    .from("invoice_payments")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId);

  return {
    hasJob: true,
    hasProofUpdate,
    hasContractSent,
    hasInvoiceSent: (invoiceCount ?? 0) > 0,
    hasPaymentRecorded: (paymentCount ?? 0) > 0,
    onboardingStartedAt: profileRow?.onboarding_started_at ?? null,
    firstJobCreatedAt: profileRow?.first_job_created_at ?? null,
    firstJobUpdateAt: profileRow?.first_job_update_at ?? null,
    firstContractSentAt: profileRow?.first_contract_sent_at ?? null,
    firstInvoiceSentAt: profileRow?.first_invoice_sent_at ?? null,
    firstPaymentRecordedAt: profileRow?.first_payment_recorded_at ?? null,
    onboardingCompletedAt: profileRow?.onboarding_completed_at ?? null,
  };
}
