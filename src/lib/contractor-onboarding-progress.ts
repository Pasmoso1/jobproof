import {
  getContractorActivationState,
  isOnboardingProgressCardComplete,
  type ContractorActivationState,
} from "@/lib/contractor-activation";

export type ContractorOnboardingProgress = Pick<
  ContractorActivationState,
  "hasJob" | "hasProofUpdate" | "hasContractSent" | "hasInvoiceSent"
>;

/**
 * Lightweight onboarding steps for new contractors (no fake data).
 */
export async function getContractorOnboardingProgress(
  profileId: string
): Promise<ContractorOnboardingProgress> {
  const state = await getContractorActivationState(profileId);
  return {
    hasJob: state.hasJob,
    hasProofUpdate: state.hasProofUpdate,
    hasContractSent: state.hasContractSent,
    hasInvoiceSent: state.hasInvoiceSent,
  };
}

/** Hide progress card when all four checklist steps are done. */
export function isOnboardingProgressComplete(p: ContractorOnboardingProgress): boolean {
  return isOnboardingProgressCardComplete(p);
}
