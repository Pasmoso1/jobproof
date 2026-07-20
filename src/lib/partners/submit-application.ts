import { randomUUID } from "node:crypto";
import {
  PARTNER_AGREEMENT_VERSION,
  PARTNER_TYPES,
} from "@/lib/partners/constants";
import { validateCanadianPhone } from "@/lib/canada/phone";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PartnerApplyResult =
  | { success: true; applicationId: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

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
  };
}

export function validatePartnerApplication(
  input: ParsedPartnerApplication
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
  return fieldErrors;
}

export function buildPartnerApplicationInsertRow(
  input: ParsedPartnerApplication,
  options?: {
    applicationId?: string;
    agreementAcceptedAt?: string;
    agreementVersion?: string;
  }
): Record<string, unknown> {
  return {
    id: options?.applicationId ?? randomUUID(),
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
    agreement_version: options?.agreementVersion ?? PARTNER_AGREEMENT_VERSION,
    agreement_accepted_at:
      options?.agreementAcceptedAt ?? new Date().toISOString(),
  };
}

export function mapPartnerApplicationInsertError(
  error: PartnerApplicationInsertError
): PartnerApplyResult {
  const code = error.code ?? "";
  if (code === "23505") {
    return {
      success: false,
      error:
        "An application with this email is already on file. If you need help, contact us.",
    };
  }
  if (code === "23514" || code === "22P02" || code === "23502") {
    return {
      success: false,
      error:
        "Some of the submitted information is invalid. Please review and try again.",
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

export async function submitPartnerApplicationCore(input: {
  formData: FormData;
  insertClient: PartnerApplicationInsertClient;
  /** Optional secure server-side duplicate check (service role). */
  findOpenApplicationIdByEmail?: (email: string) => Promise<string | null>;
  now?: Date;
}): Promise<PartnerApplyResult> {
  const parsed = parsePartnerApplicationFormData(input.formData);
  const fieldErrors = validatePartnerApplication(parsed);
  if (Object.keys(fieldErrors).length) {
    const missingAgreement = Boolean(fieldErrors.agreement_accepted);
    return {
      success: false,
      error: missingAgreement
        ? "You must accept the Partner Program Agreement before submitting."
        : "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  if (input.findOpenApplicationIdByEmail) {
    const existingId = await input.findOpenApplicationIdByEmail(parsed.email);
    if (existingId) {
      return {
        success: false,
        error:
          "An application with this email is already under review. If you need help, contact us.",
      };
    }
  }

  const agreementAcceptedAt = (input.now ?? new Date()).toISOString();
  const row = buildPartnerApplicationInsertRow(parsed, {
    agreementAcceptedAt,
    agreementVersion: PARTNER_AGREEMENT_VERSION,
  });

  const inserted = await insertPartnerApplicationWithoutSelect(
    input.insertClient,
    row
  );
  if (!inserted.ok) {
    logPartnerApplicationInsertError(inserted.error);
    return mapPartnerApplicationInsertError(inserted.error);
  }

  return { success: true, applicationId: inserted.applicationId };
}

function blankToNull(value: string): string | null {
  return value ? value : null;
}
