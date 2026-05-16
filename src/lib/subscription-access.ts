export type ProfileSubscriptionGate = {
  subscription_status?: string | null;
  grace_period_ends_at?: string | null;
  trial_ends_at?: string | null;
  subscription_current_period_end?: string | null;
  subscription_cancel_at_period_end?: boolean | null;
  subscription_cancel_at?: string | null;
  subscription_canceled_at?: string | null;
};

export type SubscriptionAccessResult = {
  canCreateJobs: boolean;
  canCreateEstimates: boolean;
  canCreateContracts: boolean;
  canSendContracts: boolean;
  canCreateInvoices: boolean;
  canSendInvoices: boolean;
  isReadOnlyMode: boolean;
  /** Short summary for logs / secondary UI */
  reason: string;
  /** Primary line on Billing when `isReadOnlyMode` (exact product copy). */
  billingReasonLabel: string | null;
  /** Human-readable subscription state */
  statusLabel: string;
  /** Returned from server actions when a write is blocked */
  readOnlyActionError: string | null;
  /** Non-null only when `ALLOW_FREE_BETA_WITHOUT_SUBSCRIPTION=1` applies */
  freeBetaHelperCopy: string | null;
};

export const READ_ONLY_MODE_ACTION_ERROR =
  "Your account is in read-only mode. Update billing to continue creating and sending documents.";

export const FREE_BETA_HELPER_COPY =
  "Free beta access is enabled. Billing restrictions are temporarily disabled.";

const ALLOW_FREE_BETA_WITHOUT_SUBSCRIPTION =
  process.env.ALLOW_FREE_BETA_WITHOUT_SUBSCRIPTION === "1";

function isFutureIso(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return t > Date.now();
}

/** Exported for billing resume / portal guards (scheduled access must still be in the future). */
export function isSubscriptionTimestampInFuture(iso: string | null | undefined): boolean {
  return isFutureIso(iso);
}

function isPastOrNowIso(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return t <= Date.now();
}

function isTrialLikeStatus(status: string): boolean {
  return status === "trial" || status === "trialing";
}

/**
 * Best timestamp for "access until" when `cancel_at_period_end` is true.
 * Prefer Stripe `subscription_cancel_at`, then trial end (during trial), then billing period end.
 */
function scheduledAccessEndIso(input: ProfileSubscriptionGate): string | null {
  const ca = String(input.subscription_cancel_at ?? "").trim();
  if (ca) return ca;
  const status = String(input.subscription_status ?? "").trim().toLowerCase();
  if (isTrialLikeStatus(status)) {
    const te = String(input.trial_ends_at ?? "").trim();
    if (te) return te;
  }
  const pe = String(input.subscription_current_period_end ?? "").trim();
  return pe || null;
}

/** Display date for billing copy (same priority as access end). */
export function pickScheduledSubscriptionAccessEndIso(
  input: ProfileSubscriptionGate
): string | null {
  return scheduledAccessEndIso(input);
}

function allWrites(
  writes: boolean,
  rest: {
    isReadOnlyMode: boolean;
    reason: string;
    billingReasonLabel: string | null;
    statusLabel: string;
    readOnlyActionError: string | null;
    freeBetaHelperCopy: string | null;
  }
): SubscriptionAccessResult {
  return {
    canCreateJobs: writes,
    canCreateEstimates: writes,
    canCreateContracts: writes,
    canSendContracts: writes,
    canCreateInvoices: writes,
    canSendInvoices: writes,
    ...rest,
  };
}

/**
 * Subscription / billing gate for contractor write actions.
 *
 * Write access: `active`, `trial`/`trialing` (trial not ended), `past_due` with grace still open,
 * or empty status when ALLOW_FREE_BETA_WITHOUT_SUBSCRIPTION=1.
 *
 * Scheduled cancel: while Stripe reports `cancel_at_period_end` with status still active/trialing,
 * writes continue until `scheduledAccessEndIso` (cancel_at, trial end, or period end).
 *
 * Read-only: canceled, unpaid, incomplete, incomplete_expired, past_due after grace, empty status
 * without beta, trialing with ended trial, unknown statuses.
 */
export function getSubscriptionAccess(input: ProfileSubscriptionGate): SubscriptionAccessResult {
  const status = String(input.subscription_status ?? "").trim().toLowerCase();
  const trialEndedWhileTrialing =
    isTrialLikeStatus(status) && isPastOrNowIso(input.trial_ends_at);
  const cancelAtPeriodEnd = input.subscription_cancel_at_period_end === true;

  if (!status) {
    if (ALLOW_FREE_BETA_WITHOUT_SUBSCRIPTION) {
      return allWrites(true, {
        isReadOnlyMode: false,
        reason: "Free beta access enabled.",
        billingReasonLabel: null,
        statusLabel: "Free beta",
        readOnlyActionError: null,
        freeBetaHelperCopy: FREE_BETA_HELPER_COPY,
      });
    }
    return allWrites(false, {
      isReadOnlyMode: true,
      reason: "No active subscription.",
      billingReasonLabel: "No active subscription",
      statusLabel: "No subscription",
      readOnlyActionError: READ_ONLY_MODE_ACTION_ERROR,
      freeBetaHelperCopy: null,
    });
  }

  if (status === "active") {
    if (cancelAtPeriodEnd) {
      const until = scheduledAccessEndIso(input);
      if (!until || !isFutureIso(until)) {
        return allWrites(false, {
          isReadOnlyMode: true,
          reason: "Subscription canceled.",
          billingReasonLabel: "Subscription canceled",
          statusLabel: "Canceled",
          readOnlyActionError: READ_ONLY_MODE_ACTION_ERROR,
          freeBetaHelperCopy: null,
        });
      }
      return allWrites(true, {
        isReadOnlyMode: false,
        reason: "Subscription active until scheduled cancellation.",
        billingReasonLabel: null,
        statusLabel: "Active · Scheduled to cancel",
        readOnlyActionError: null,
        freeBetaHelperCopy: null,
      });
    }
    return allWrites(true, {
      isReadOnlyMode: false,
      reason: "Subscription active.",
      billingReasonLabel: null,
      statusLabel: "Active",
      readOnlyActionError: null,
      freeBetaHelperCopy: null,
    });
  }

  if (isTrialLikeStatus(status)) {
    if (trialEndedWhileTrialing) {
      return allWrites(false, {
        isReadOnlyMode: true,
        reason: "Trial ended.",
        billingReasonLabel: "Trial ended",
        statusLabel: "Trial ended",
        readOnlyActionError: READ_ONLY_MODE_ACTION_ERROR,
        freeBetaHelperCopy: null,
      });
    }
    if (cancelAtPeriodEnd) {
      const until = scheduledAccessEndIso(input);
      if (!until || !isFutureIso(until)) {
        return allWrites(false, {
          isReadOnlyMode: true,
          reason: "Trial ended.",
          billingReasonLabel: "Trial ended",
          statusLabel: "Trial ended",
          readOnlyActionError: READ_ONLY_MODE_ACTION_ERROR,
          freeBetaHelperCopy: null,
        });
      }
      return allWrites(true, {
        isReadOnlyMode: false,
        reason: "Trial active.",
        billingReasonLabel: null,
        statusLabel: "Trial active · Scheduled to cancel",
        readOnlyActionError: null,
        freeBetaHelperCopy: null,
      });
    }
    return allWrites(true, {
      isReadOnlyMode: false,
      reason: "Trial active.",
      billingReasonLabel: null,
      statusLabel: "Trial active",
      readOnlyActionError: null,
      freeBetaHelperCopy: null,
    });
  }

  if (status === "past_due") {
    if (isFutureIso(input.grace_period_ends_at)) {
      return allWrites(true, {
        isReadOnlyMode: false,
        reason: "Payment past due. Grace period is active.",
        billingReasonLabel: null,
        statusLabel: "Past due (grace period)",
        readOnlyActionError: null,
        freeBetaHelperCopy: null,
      });
    }
    const hadGraceWindow = Boolean(
      input.grace_period_ends_at && String(input.grace_period_ends_at).trim()
    );
    return allWrites(false, {
      isReadOnlyMode: true,
      reason: hadGraceWindow ? "Grace period ended." : "Payment failed.",
      billingReasonLabel: hadGraceWindow ? "Grace period ended" : "Payment failed",
      statusLabel: "Past due",
      readOnlyActionError: READ_ONLY_MODE_ACTION_ERROR,
      freeBetaHelperCopy: null,
    });
  }

  if (status === "unpaid") {
    return allWrites(false, {
      isReadOnlyMode: true,
      reason: "Payment failed.",
      billingReasonLabel: "Payment failed",
      statusLabel: "Unpaid",
      readOnlyActionError: READ_ONLY_MODE_ACTION_ERROR,
      freeBetaHelperCopy: null,
    });
  }

  if (status === "canceled" || status === "cancelled") {
    if (ALLOW_FREE_BETA_WITHOUT_SUBSCRIPTION) {
      return allWrites(true, {
        isReadOnlyMode: false,
        reason: "Free beta access enabled.",
        billingReasonLabel: null,
        statusLabel: "Canceled (free beta)",
        readOnlyActionError: null,
        freeBetaHelperCopy: FREE_BETA_HELPER_COPY,
      });
    }
    return allWrites(false, {
      isReadOnlyMode: true,
      reason: "Subscription canceled.",
      billingReasonLabel: "Subscription canceled",
      statusLabel: "Canceled",
      readOnlyActionError: READ_ONLY_MODE_ACTION_ERROR,
      freeBetaHelperCopy: null,
    });
  }

  if (status === "incomplete" || status === "incomplete_expired") {
    return allWrites(false, {
      isReadOnlyMode: true,
      reason: "Subscription incomplete.",
      billingReasonLabel: "Subscription incomplete",
      statusLabel: status === "incomplete_expired" ? "Incomplete (expired)" : "Incomplete",
      readOnlyActionError: READ_ONLY_MODE_ACTION_ERROR,
      freeBetaHelperCopy: null,
    });
  }

  return allWrites(false, {
    isReadOnlyMode: true,
    reason: "Subscription inactive. Payment required for write actions.",
    billingReasonLabel: "Subscription inactive",
    statusLabel: status ? status.replace(/_/g, " ") : "Unknown",
    readOnlyActionError: READ_ONLY_MODE_ACTION_ERROR,
    freeBetaHelperCopy: null,
  });
}
