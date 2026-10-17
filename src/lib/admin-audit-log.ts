import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Append-only audit trail for sensitive admin mutations (table: `admin_audit_logs`,
 * migration 071). Server-side only: rows are written with the service-role client AFTER
 * the mutation has succeeded.
 *
 * Guarantees / limits (also documented in the Phase 1 report):
 * - Never throws. An audit-write failure never rolls back or masks the already-completed
 *   admin action. It is logged under the greppable tag `[admin-audit] FAILED` (action,
 *   target id, admin, error code; never metadata) so it can be monitored and reconciled
 *   from runtime logs, and financial actions also surface `auditWarning` to the admin UI.
 * - Not atomic with the mutation: the mutation and the audit insert are two requests.
 *   If the process dies between them, or the table is unavailable, the action happens
 *   without an audit row. Atomic logging would need a SQL function per action (deferred).
 * - One-shot actions pass an `idempotencyKey`; a retry hits the unique index and is
 *   reported as `duplicate` instead of writing a second record.
 * - Metadata is allowlisted to small primitive values; secrets, URLs and contact details
 *   are stripped (see {@link sanitizeAuditMetadata}).
 */

export const ADMIN_AUDIT_ACTIONS = {
  partnerApplicationUnderReview: "partner_application_under_review",
  partnerApplicationApproved: "partner_application_approved",
  partnerApplicationDeclined: "partner_application_declined",
  partnerSuspended: "partner_suspended",
  partnerReactivated: "partner_reactivated",
  partnerTypeChanged: "partner_type_changed",
  partnerLevelChanged: "partner_level_changed",
  partnerVerificationEmailResent: "partner_verification_email_resent",
  partnerPasswordResetEmailSent: "partner_password_reset_email_sent",
  referralRewardAdjusted: "referral_reward_adjusted",
  referralRewardApproved: "referral_reward_approved",
  referralMarkedPaid: "referral_marked_paid",
  referralForceReleased: "referral_force_released",
  referralReleasedForPayment: "referral_released_for_payment",
  referralInvalidated: "referral_invalidated",
  referralReverified: "referral_reverified",
  partnerBatchPayoutRecorded: "partner_batch_payout_recorded",
} as const;

export type AdminAuditAction =
  (typeof ADMIN_AUDIT_ACTIONS)[keyof typeof ADMIN_AUDIT_ACTIONS];

export type AdminAuditTargetType =
  | "partner_application"
  | "partner"
  | "partner_referral"
  | "partner_payout";

export type AuditMetadataValue = string | number | boolean | null;
export type AuditMetadata = Record<string, AuditMetadataValue>;

const MAX_METADATA_KEYS = 20;
const MAX_STRING_LENGTH = 200;

/** Keys that could carry secrets or personal data are dropped outright. */
const BLOCKED_KEY_PATTERN =
  /token|secret|password|passcode|authorization|credential|api[_-]?key|link|url|email|phone|address|iban|card|account_number|reason|notes?$/i;

/**
 * Reduces arbitrary metadata to a small, safe object of primitives. Free-text fields
 * (reasons, notes) are intentionally excluded: they already live on the source record, and
 * audit rows should reference rather than copy them.
 */
export function sanitizeAuditMetadata(
  input: Record<string, unknown> | null | undefined
): AuditMetadata {
  const out: AuditMetadata = {};
  if (!input) return out;
  for (const [key, raw] of Object.entries(input)) {
    if (Object.keys(out).length >= MAX_METADATA_KEYS) break;
    if (!key || BLOCKED_KEY_PATTERN.test(key)) continue;
    if (raw === null) {
      out[key] = null;
    } else if (typeof raw === "boolean") {
      out[key] = raw;
    } else if (typeof raw === "number") {
      if (Number.isFinite(raw)) out[key] = raw;
    } else if (typeof raw === "string") {
      const value = raw.trim();
      if (!value) continue;
      // Drop anything that looks like a URL or a bearer-style token.
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) || /[A-Za-z0-9_-]{40,}/.test(value)) continue;
      out[key] = value.slice(0, MAX_STRING_LENGTH);
    }
  }
  return out;
}

/** Stable key for one-shot actions so retries do not create duplicate records. */
export function buildAuditIdempotencyKey(
  action: AdminAuditAction,
  targetId: string,
  discriminator?: string | null
): string {
  const suffix = discriminator?.trim() ? `:${discriminator.trim()}` : "";
  return `${action}:${targetId}${suffix}`;
}

export type RecordAdminAuditInput = {
  adminEmail: string;
  action: AdminAuditAction;
  targetType: AdminAuditTargetType;
  targetId: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string | null;
};

export type RecordAdminAuditResult =
  | { ok: true; duplicate: boolean }
  | { ok: false };

/** Shown to the administrator when a financial action succeeded but could not be audited. */
export const AUDIT_WARNING_MESSAGE =
  "The action succeeded, but its audit-log entry could not be saved. Note this action and tell engineering (server logs: [admin-audit] FAILED).";

/**
 * Spread into a financial action's result: `{ ...auditWarning(audit) }`. Adds nothing when the
 * audit was recorded (or was a deduplicated retry), or when there was nothing to audit (`null`).
 */
export function auditWarning(
  result: RecordAdminAuditResult | null | undefined
): { auditWarning?: string } {
  return result && !result.ok ? { auditWarning: AUDIT_WARNING_MESSAGE } : {};
}

type AuditClient = Pick<SupabaseClient, "from">;

/** Single, greppable failure record. Contains identifiers only, never metadata or secrets. */
function logAuditFailure(
  input: RecordAdminAuditInput,
  reason: string,
  code?: string | null
) {
  console.error("[admin-audit] FAILED", {
    reason,
    action: input.action,
    targetType: input.targetType,
    targetId: String(input.targetId ?? "").trim() || null,
    adminEmail: String(input.adminEmail ?? "").trim().toLowerCase() || null,
    idempotencyKey: input.idempotencyKey?.trim() || null,
    code: code ?? null,
  });
}

export async function recordAdminAudit(
  admin: AuditClient,
  input: RecordAdminAuditInput
): Promise<RecordAdminAuditResult> {
  const adminEmail = String(input.adminEmail ?? "").trim().toLowerCase();
  const targetId = String(input.targetId ?? "").trim();
  if (!adminEmail || !targetId) {
    logAuditFailure(input, "missing_identity_or_target");
    return { ok: false };
  }

  try {
    const { error } = await admin.from("admin_audit_logs").insert({
      admin_email: adminEmail,
      action: input.action,
      target_type: input.targetType,
      target_id: targetId,
      idempotency_key: input.idempotencyKey?.trim() || null,
      metadata: sanitizeAuditMetadata(input.metadata),
    });
    if (!error) return { ok: true, duplicate: false };
    // Unique violation on idempotency_key = the same action was already recorded.
    if (error.code === "23505") return { ok: true, duplicate: true };
    logAuditFailure(input, "insert_failed", error.code ?? null);
    return { ok: false };
  } catch {
    logAuditFailure(input, "insert_threw");
    return { ok: false };
  }
}