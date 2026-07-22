import { randomUUID } from "node:crypto";
import {
  PARTNER_AGREEMENT_VERSION,
  PARTNER_TYPES,
} from "@/lib/partners/constants";
import { validateCanadianPhone } from "@/lib/canada/phone";
import {
  validatePartnerLoginIdentifier,
  validatePartnerPassword,
} from "@/lib/partners/username";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PartnerApplyErrorCode =
  | "existing_account"
  | "username_taken"
  | "validation"
  | "auth_failed"
  | "duplicate_application"
  | "email_mismatch"
  | "auth_required";

export type PartnerApplyFlow = "new_account" | "existing_account";

export type PartnerApplyResult =
  | {
      success: true;
      applicationId: string;
      emailVerificationSent?: boolean;
      flow: PartnerApplyFlow;
    }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string>;
      code?: PartnerApplyErrorCode;
    };

export type PartnerApplicationInsertError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

/** Minimal insert client — must not require a .select() chain. */
export type PartnerApplicationInsertClient = {
  from: (table: "partner_applications") => {
    insert: (
      row: Record<string, unknown>
    ) => PromiseLike<{ error: PartnerApplicationInsertError | null }>;
  };
};

export type ParsedPartnerApplication = {
  organizationName: string;
  contactName: string;
  email: string;
  phone: string | null;
  website: string | null;
  partnerType: string;
  estimatedAudience: string | null;
  promotionPlan: string;
  reason: string;
  agreementAccepted: boolean;
  username: string;
  password: string;
  confirmPassword: string;
  /** Honeypot — must be empty. */
  companyWebsiteTrap: string;
};

export type TrustedPartnerApplySession = {
  id: string;
  email: string;
  emailConfirmedAt: string | null;
};

export function parsePartnerApplicationFormData(
  formData: FormData
): ParsedPartnerApplication {
  return {
    organizationName: String(formData.get("organization_name") ?? "").trim(),
    contactName: String(formData.get("contact_name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    phone: blankToNull(String(formData.get("phone") ?? "").trim()),
    website: blankToNull(String(formData.get("website") ?? "").trim()),
    partnerType: String(formData.get("partner_type") ?? "").trim(),
    estimatedAudience: blankToNull(
      String(formData.get("estimated_audience") ?? "").trim()
    ),
    promotionPlan: String(formData.get("promotion_plan") ?? "").trim(),
    reason: String(formData.get("reason") ?? "").trim(),
    agreementAccepted: formData.get("agreement_accepted") === "on",
    username: String(formData.get("username") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirm_password") ?? ""),
    companyWebsiteTrap: String(formData.get("company_website") ?? "").trim(),
  };
}

/**
 * Flow is selected only from a trusted Auth session — never from client hints,
 * browser-supplied auth_user_id, or “email looks familiar”.
 */
export function resolvePartnerApplyFlow(
  authenticatedUser: TrustedPartnerApplySession | null | undefined
): PartnerApplyFlow {
  return authenticatedUser?.id && authenticatedUser.email
    ? "existing_account"
    : "new_account";
}

export function validatePartnerApplication(
  input: ParsedPartnerApplication,
  options: { requirePassword: boolean }
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  if (!input.organizationName) {
    fieldErrors.organization_name = "Organization name is required.";
  }
  if (!input.contactName) {
    fieldErrors.contact_name = "Contact name is required.";
  }
  if (!input.email || !EMAIL_RE.test(input.email)) {
    fieldErrors.email = "Enter a valid email address.";
  }
  if (input.phone) {
    const phoneErr = validateCanadianPhone(input.phone, {
      required: false,
      label: "phone number",
    });
    if (phoneErr) fieldErrors.phone = phoneErr;
  }
  if (!PARTNER_TYPES.some((t) => t.value === input.partnerType)) {
    fieldErrors.partner_type = "Select a partner type.";
  }
  if (!input.promotionPlan) {
    fieldErrors.promotion_plan = "Tell us how you plan to promote JobProof.";
  }
  if (!input.reason) {
    fieldErrors.reason = "Tell us why you’d like to become a partner.";
  }
  if (!input.agreementAccepted) {
    fieldErrors.agreement_accepted =
      "You must read and accept the Partner Program Agreement.";
  }

  const loginId = validatePartnerLoginIdentifier(input.username, {
    applicationEmail: input.email,
  });
  if (!loginId.ok) {
    fieldErrors.username = loginId.error;
  }

  if (options.requirePassword) {
    const passwordError = validatePartnerPassword(
      input.password,
      input.confirmPassword
    );
    if (passwordError) {
      fieldErrors.password = passwordError;
      if (passwordError.includes("confirmation")) {
        fieldErrors.confirm_password = passwordError;
      }
    }
  }

  return fieldErrors;
}

export function buildPartnerApplicationInsertRow(
  input: ParsedPartnerApplication,
  options: {
    applicationId?: string;
    agreementAcceptedAt?: string;
    agreementVersion?: string;
    username: string | null;
    normalizedUsername: string | null;
    authUserId: string;
    emailConfirmedAt?: string | null;
  }
): Record<string, unknown> {
  return {
    id: options.applicationId ?? randomUUID(),
    organization_name: input.organizationName,
    contact_name: input.contactName,
    email: input.email,
    phone: input.phone,
    website: input.website,
    partner_type: input.partnerType,
    estimated_audience: input.estimatedAudience,
    promotion_plan: input.promotionPlan,
    reason: input.reason,
    status: "submitted",
    agreement_version: options.agreementVersion ?? PARTNER_AGREEMENT_VERSION,
    agreement_accepted_at:
      options.agreementAcceptedAt ?? new Date().toISOString(),
    username: options.username,
    normalized_username: options.normalizedUsername,
    auth_user_id: options.authUserId,
    email_confirmed_at: options.emailConfirmedAt ?? null,
  };
}

export function mapPartnerApplicationInsertError(
  error: PartnerApplicationInsertError
): PartnerApplyResult {
  const code = error.code ?? "";
  if (code === "23505") {
    const msg = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
    if (msg.includes("username") || msg.includes("normalized_username")) {
      return {
        success: false,
        error: "That username is already taken. Please choose another.",
        code: "username_taken",
        fieldErrors: { username: "That username is already taken." },
      };
    }
    return {
      success: false,
      error:
        "An application with this email is already on file. If you need help, contact us.",
      code: "duplicate_application",
    };
  }
  if (code === "23514" || code === "22P02" || code === "23502") {
    return {
      success: false,
      error:
        "Some of the submitted information is invalid. Please review and try again.",
      code: "validation",
    };
  }
  return {
    success: false,
    error:
      "We could not submit your application due to a temporary database problem. Please try again shortly.",
  };
}

/** Log Supabase errors without applicant personal information. */
export function logPartnerApplicationInsertError(
  error: PartnerApplicationInsertError,
  logger: Pick<Console, "error"> = console
): void {
  logger.error("[partners] application insert failed", {
    code: error.code ?? null,
    message: error.message ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
  });
}

/**
 * Safe apply-flow diagnostics — never log passwords, tokens, or emails.
 */
export function logPartnerApplyAuthDiagnostics(input: {
  authState: "signed_in" | "signed_out";
  userId: string | null;
  flow: PartnerApplyFlow;
  logger?: Pick<Console, "info">;
}): void {
  const logger = input.logger ?? console;
  logger.info("[partners] apply auth diagnostics", {
    auth_state_resolved: input.authState,
    authenticated_user_id: input.userId,
    application_flow_selected: input.flow,
  });
}

/**
 * Insert a partner application without requiring SELECT permission.
 * Generates the row id server-side so follow-up updates can use service role.
 */
export async function insertPartnerApplicationWithoutSelect(
  client: PartnerApplicationInsertClient,
  row: Record<string, unknown>
): Promise<
  | { ok: true; applicationId: string }
  | { ok: false; error: PartnerApplicationInsertError }
> {
  const applicationId = String(row.id ?? "");
  if (!applicationId) {
    return {
      ok: false,
      error: { message: "Application id missing before insert" },
    };
  }

  const { error } = await client.from("partner_applications").insert(row);
  if (error) return { ok: false, error };
  return { ok: true, applicationId };
}

export type PartnerAuthProvisionResult =
  | {
      ok: true;
      userId: string;
      emailConfirmedAt: string | null;
      createdNewAuthUser: boolean;
    }
  | {
      ok: false;
      error: string;
      code?: PartnerApplyErrorCode;
      fieldErrors?: Record<string, string>;
    };

/**
 * Multi-step application submit with Auth + username linking.
 * Passwords are never written to application rows or logs.
 *
 * New-account: no trusted session → password required → create Auth user.
 * Existing-account: trusted session required → email locked to Auth email →
 * no password accepted/required → link auth.uid().
 */
export async function submitPartnerApplicationCore(input: {
  formData: FormData;
  insertClient: PartnerApplicationInsertClient;
  findOpenApplicationIdByEmail?: (email: string) => Promise<string | null>;
  /** Trusted session from server getUser() only — never trust client claims. */
  authenticatedUser?: TrustedPartnerApplySession | null;
  provisionAuthUser: (args: {
    email: string;
    password: string;
    username: string;
  }) => Promise<PartnerAuthProvisionResult>;
  claimUsername: (args: {
    username: string;
    normalized: string;
    authUserId: string;
    applicationId: string;
  }) => Promise<{ ok: true } | { ok: false; error: string; code?: string }>;
  releaseUsernameClaim: (normalized: string) => Promise<void>;
  deleteOrphanAuthUser?: (userId: string) => Promise<void>;
  linkRegistryApplication?: (
    normalized: string,
    applicationId: string
  ) => Promise<void>;
  checkUsernameAvailable: (normalized: string) => Promise<boolean>;
  now?: Date;
  logger?: Pick<Console, "info" | "error">;
}): Promise<PartnerApplyResult> {
  const parsed = parsePartnerApplicationFormData(input.formData);

  // Honeypot — silent success-shaped rejection for bots.
  if (parsed.companyWebsiteTrap) {
    return {
      success: true,
      applicationId: randomUUID(),
      flow: "new_account",
    };
  }

  const session = input.authenticatedUser ?? null;
  const flow = resolvePartnerApplyFlow(session);

  logPartnerApplyAuthDiagnostics({
    authState: session ? "signed_in" : "signed_out",
    userId: session?.id ?? null,
    flow,
    logger: input.logger,
  });

  // Existing-account: lock email to the trusted Auth email.
  if (flow === "existing_account" && session) {
    const trustedEmail = session.email.trim().toLowerCase();
    if (parsed.email && parsed.email !== trustedEmail) {
      return {
        success: false,
        error:
          "Your application email must match the signed-in JobProof account. Sign out to apply with a different email.",
        code: "email_mismatch",
        fieldErrors: {
          email:
            "This field is locked to your signed-in account. Sign out to use another email.",
        },
      };
    }
    parsed.email = trustedEmail;
  }

  const requirePassword = flow === "new_account";

  // Hard server-side gate: guests cannot submit without a password, even if the
  // browser form omitted password fields.
  if (flow === "new_account" && !parsed.password) {
    return {
      success: false,
      error: "Password is required to create your Partner Portal account.",
      code: "validation",
      fieldErrors: { password: "Password is required." },
    };
  }

  const fieldErrors = validatePartnerApplication(parsed, { requirePassword });
  if (Object.keys(fieldErrors).length) {
    const missingAgreement = Boolean(fieldErrors.agreement_accepted);
    return {
      success: false,
      error: missingAgreement
        ? "You must accept the Partner Program Agreement before submitting."
        : "Please fix the highlighted fields.",
      fieldErrors,
      code: "validation",
    };
  }

  const loginId = validatePartnerLoginIdentifier(parsed.username, {
    applicationEmail: parsed.email,
  });
  if (!loginId.ok) {
    return {
      success: false,
      error: loginId.error,
      fieldErrors: { username: loginId.error },
      code: "validation",
    };
  }

  if (input.findOpenApplicationIdByEmail) {
    const existingId = await input.findOpenApplicationIdByEmail(parsed.email);
    if (existingId) {
      return {
        success: false,
        error:
          "An application with this email is already under review. If you need help, contact us.",
        code: "duplicate_application",
      };
    }
  }

  if (loginId.kind === "username") {
    const available = await input.checkUsernameAvailable(loginId.normalized);
    if (!available) {
      return {
        success: false,
        error: "That username is already taken. Please choose another.",
        code: "username_taken",
        fieldErrors: { username: "That username is already taken." },
      };
    }
  }

  let authUserId: string;
  let emailConfirmedAt: string | null = null;
  let createdNewAuthUser = false;

  if (flow === "existing_account") {
    if (!session?.id) {
      return {
        success: false,
        error: "Sign in is required to continue with an existing JobProof account.",
        code: "auth_required",
      };
    }
    // Never accept a client-supplied password for existing accounts.
    authUserId = session.id;
    emailConfirmedAt = session.emailConfirmedAt;
  } else {
    if (!parsed.password || parsed.password !== parsed.confirmPassword) {
      return {
        success: false,
        error: "Password and confirmation are required for new accounts.",
        code: "validation",
        fieldErrors: {
          password: "Password is required.",
          confirm_password:
            parsed.password && parsed.password !== parsed.confirmPassword
              ? "Password and confirmation do not match."
              : "Confirm your password.",
        },
      };
    }

    const provisioned = await input.provisionAuthUser({
      email: parsed.email,
      password: parsed.password,
      username:
        loginId.kind === "username" ? loginId.username : parsed.email,
    });
    if (!provisioned.ok) {
      return {
        success: false,
        error: provisioned.error,
        code: provisioned.code ?? "auth_failed",
        fieldErrors: provisioned.fieldErrors,
      };
    }
    if (!provisioned.userId) {
      return {
        success: false,
        error: "Could not create your account. Please try again.",
        code: "auth_failed",
      };
    }
    authUserId = provisioned.userId;
    emailConfirmedAt = provisioned.emailConfirmedAt;
    createdNewAuthUser = provisioned.createdNewAuthUser;
  }

  // Final invariant: never insert without a trusted auth_user_id.
  if (!authUserId) {
    return {
      success: false,
      error: "Could not link an authentication account. Please try again.",
      code: "auth_failed",
    };
  }

  const agreementAcceptedAt = (input.now ?? new Date()).toISOString();
  const row = buildPartnerApplicationInsertRow(parsed, {
    agreementAcceptedAt,
    agreementVersion: PARTNER_AGREEMENT_VERSION,
    username: loginId.kind === "username" ? loginId.username : null,
    normalizedUsername:
      loginId.kind === "username" ? loginId.normalized : null,
    authUserId,
    emailConfirmedAt,
  });
  const applicationId = String(row.id);

  let claimedNormalized: string | null = null;
  if (loginId.kind === "username") {
    const claimed = await input.claimUsername({
      username: loginId.username,
      normalized: loginId.normalized,
      authUserId,
      applicationId,
    });
    if (!claimed.ok) {
      if (createdNewAuthUser && input.deleteOrphanAuthUser) {
        await input.deleteOrphanAuthUser(authUserId);
      }
      if (claimed.code === "23505") {
        return {
          success: false,
          error: "That username is already taken. Please choose another.",
          code: "username_taken",
          fieldErrors: { username: "That username is already taken." },
        };
      }
      return {
        success: false,
        error: "Could not reserve that username. Please try again.",
        code: "username_taken",
      };
    }
    claimedNormalized = loginId.normalized;
  }

  const inserted = await insertPartnerApplicationWithoutSelect(
    input.insertClient,
    row
  );
  if (!inserted.ok) {
    logPartnerApplicationInsertError(inserted.error, input.logger);
    if (claimedNormalized) {
      await input.releaseUsernameClaim(claimedNormalized);
    }
    if (createdNewAuthUser && input.deleteOrphanAuthUser) {
      await input.deleteOrphanAuthUser(authUserId);
    }
    return mapPartnerApplicationInsertError(inserted.error);
  }

  if (claimedNormalized && input.linkRegistryApplication) {
    await input.linkRegistryApplication(
      claimedNormalized,
      inserted.applicationId
    );
  }

  return {
    success: true,
    applicationId: inserted.applicationId,
    emailVerificationSent: createdNewAuthUser && !emailConfirmedAt,
    flow,
  };
}

function blankToNull(value: string): string | null {
  return value ? value : null;
}
