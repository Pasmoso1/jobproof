type AccessInput = {
  subscription_status?: string | null;
  grace_period_ends_at?: string | null;
};

export type SubscriptionAccessResult = {
  canCreateContracts: boolean;
  canSendContracts: boolean;
  canCreateInvoices: boolean;
  canSendInvoices: boolean;
  isReadOnlyMode: boolean;
  reason: string;
};

const ALLOW_FREE_BETA_WITHOUT_SUBSCRIPTION =
  process.env.ALLOW_FREE_BETA_WITHOUT_SUBSCRIPTION === "1";

function isFutureIso(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return t > Date.now();
}

export function getSubscriptionAccess(input: AccessInput): SubscriptionAccessResult {
  const status = String(input.subscription_status ?? "").toLowerCase();

  if (!status) {
    if (ALLOW_FREE_BETA_WITHOUT_SUBSCRIPTION) {
      return {
        canCreateContracts: true,
        canSendContracts: true,
        canCreateInvoices: true,
        canSendInvoices: true,
        isReadOnlyMode: false,
        reason: "Free beta access enabled.",
      };
    }
    return {
      canCreateContracts: false,
      canSendContracts: false,
      canCreateInvoices: false,
      canSendInvoices: false,
      isReadOnlyMode: true,
      reason: "No active subscription.",
    };
  }

  if (status === "active" || status === "trialing" || status === "trial") {
    return {
      canCreateContracts: true,
      canSendContracts: true,
      canCreateInvoices: true,
      canSendInvoices: true,
      isReadOnlyMode: false,
      reason: status === "active" ? "Subscription active." : "Trial active.",
    };
  }

  if (status === "past_due" && isFutureIso(input.grace_period_ends_at)) {
    return {
      canCreateContracts: true,
      canSendContracts: true,
      canCreateInvoices: true,
      canSendInvoices: true,
      isReadOnlyMode: false,
      reason: "Payment past due. Grace period is active.",
    };
  }

  return {
    canCreateContracts: false,
    canSendContracts: false,
    canCreateInvoices: false,
    canSendInvoices: false,
    isReadOnlyMode: true,
    reason: "Subscription inactive. Payment required for write actions.",
  };
}

