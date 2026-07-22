import { randomUUID } from "node:crypto";
import {
  PARTNER_AGREEMENT_VERSION,
  PARTNER_TYPES,
} from "@/lib/partners/constants";
import { validateCanadianPhone } from "@/lib/canada/phone";
import {
  validatePartnerPassword,
  validatePartnerUsername,
} from "@/lib/partners/username";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PartnerApplyErrorCode =
  | "existing_account"
  | "username_taken"
  | "validation"
  | "auth_failed"
  | "duplicate_application";

export type PartnerApplyResult =
  | { success: true; applicationId: string; emailVerificationSent?: boolean }
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

export function validatePartnerApplication(
  input: ParsedPartnerApplication,
  options?: { requirePassword?: boolean }
): Record<string, string> {
  const requirePassword = options?.requirePassword !== false;
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

  const usernameResult = validatePartnerUsername(input.username);
  if (!usernameResult.ok) {
    fieldErrors.username = usernameResult.error;
  }

  if (requirePassword) {
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
    username: string;
    normalizedUsername: string;
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
 */
export async function submitPartnerApplicationCore(input: {
  formData: FormData;
  insertClient: PartnerApplicationInsertClient;
  findOpenApplicationIdByEmail?: (email: string) => Promise<string | null>;
  /** When the browser already has a signed-in user whose email matches. */
  authenticatedUser?: {
    id: string;
    email: string;
    emailConfirmedAt: string | null;
  } | null;
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
}): Promise<PartnerApplyResult> {
  const parsed = parsePartnerApplicationFormData(input.formData);

  // Honeypot — silent success-shaped rejection for bots.
  if (parsed.companyWebsiteTrap) {
    return { success: true, applicationId: randomUUID() };
  }

  const session = input.authenticatedUser ?? null;
  const sessionEmailMatches =
    Boolean(session?.email) &&
    session!.email.trim().toLowerCase() === parsed.email;
  const requirePassword = !sessionEmailMatches;

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

  const usernameValidated = validatePartnerUsername(parsed.username);
  if (!usernameValidated.ok) {
    return {
      success: false,
      error: usernameValidated.error,
      fieldErrors: { username: usernameValidated.error },
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

  const available = await input.checkUsernameAvailable(
    usernameValidated.normalized
  );
  if (!available) {
    return {
      success: false,
      error: "That username is already taken. Please choose another.",
      code: "username_taken",
      fieldErrors: { username: "That username is already taken." },
    };
  }

  let authUserId: string;
  let emailConfirmedAt: string | null = null;
  let createdNewAuthUser = false;

  if (sessionEmailMatches && session) {
    authUserId = session.id;
    emailConfirmedAt = session.emailConfirmedAt;
  } else {
    const provisioned = await input.provisionAuthUser({
      email: parsed.email,
      password: parsed.password,
      username: usernameValidated.username,
    });
    if (!provisioned.ok) {
      return {
        success: false,
        error: provisioned.error,
        code: provisioned.code ?? "auth_failed",
        fieldErrors: provisioned.fieldErrors,
      };
    }
    authUserId = provisioned.userId;
    emailConfirmedAt = provisioned.emailConfirmedAt;
    createdNewAuthUser = provisioned.createdNewAuthUser;
  }

  const agreementAcceptedAt = (input.now ?? new Date()).toISOString();
  const row = buildPartnerApplicationInsertRow(parsed, {
    agreementAcceptedAt,
    agreementVersion: PARTNER_AGREEMENT_VERSION,
    username: usernameValidated.username,
    normalizedUsername: usernameValidated.normalized,
    authUserId,
    emailConfirmedAt,
  });
  const applicationId = String(row.id);

  const claimed = await input.claimUsername({
    username: usernameValidated.username,
    normalized: usernameValidated.normalized,
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

  const inserted = await insertPartnerApplicationWithoutSelect(
    input.insertClient,
    row
  );
  if (!inserted.ok) {
    logPartnerApplicationInsertError(inserted.error);
    await input.releaseUsernameClaim(usernameValidated.normalized);
    if (createdNewAuthUser && input.deleteOrphanAuthUser) {
      await input.deleteOrphanAuthUser(authUserId);
    }
    return mapPartnerApplicationInsertError(inserted.error);
  }

  if (input.linkRegistryApplication) {
    await input.linkRegistryApplication(
      usernameValidated.normalized,
      inserted.applicationId
    );
  }

  return {
    success: true,
    applicationId: inserted.applicationId,
    emailVerificationSent: createdNewAuthUser && !emailConfirmedAt,
  };
}

function blankToNull(value: string): string | null {
  return value ? value : null;
}
