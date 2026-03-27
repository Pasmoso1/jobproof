/** Shown when contract-governing job fields cannot be edited. */
export const JOB_LOCKED_SIGNED_CONTRACT_MESSAGE =
  "This job is locked because the contract has been signed.";

export function isJobLockedForContractEdits(
  contractStatus: string | null | undefined
): boolean {
  return contractStatus === "signed";
}
