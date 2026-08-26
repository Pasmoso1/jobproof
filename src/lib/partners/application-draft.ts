/**
 * Session-only Partner application draft for existing-account sign-in continuation.
 * Never stores passwords, tokens, or other secrets.
 */

export const PARTNER_APPLICATION_DRAFT_KEY = "jobproof_partner_application_draft";

export const PARTNER_APPLY_LOGIN_NEXT = "/partners/apply";
export const ORGANIZATION_APPLY_LOGIN_NEXT = "/partners/organizations/apply";

/** Fields that must never be written to sessionStorage. */
const SENSITIVE_FIELD_NAMES = new Set([
  "password",
  "confirm_password",
  "company_website",
]);

export type PartnerApplicationDraft = {
  version: 1;
  savedAt: string;
  /** True after redirecting to login so the apply page can show a restore banner. */
  pendingRestore: boolean;
  returnPath: string;
  fields: Record<string, string>;
};

const ALLOWED_FIELD_NAMES = new Set([
  "partner_type",
  "organization_name",
  "contact_name",
  "email",
  "phone",
  "website",
  "primary_platform",
  "additional_links",
  "estimated_audience",
  "primary_audience",
  "province",
  "promotion_method",
  "promotion_plan",
  "reason",
  "username",
  // Organization-specific (shared draft helper)
  "organization_type",
  "job_title",
  "member_count",
  "primary_industries",
  "geographic_coverage",
  "newsletter_size",
  "social_audience",
  "website_traffic",
  "additional_comments",
]);

function getSessionStorage(): Storage | null {
  try {
    const storage = (globalThis as { sessionStorage?: Storage }).sessionStorage;
    if (!storage) return null;
    return storage;
  } catch {
    return null;
  }
}

function sanitizeFields(raw: Record<string, string>): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (SENSITIVE_FIELD_NAMES.has(key)) continue;
    if (!ALLOWED_FIELD_NAMES.has(key) && !key.startsWith("channel_") && !key.startsWith("interest_")) {
      continue;
    }
    const trimmed = String(value ?? "");
    if (!trimmed) continue;
    fields[key] = trimmed;
  }
  return fields;
}

export function collectPartnerApplicationDraftFields(
  form: FormData | HTMLFormElement,
  extras?: Record<string, string | null | undefined>
): Record<string, string> {
  const fd = form instanceof FormData ? form : new FormData(form);
  const raw: Record<string, string> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value !== "string") continue;
    raw[key] = value;
  }
  if (extras) {
    for (const [key, value] of Object.entries(extras)) {
      if (value == null || value === "") continue;
      raw[key] = value;
    }
  }
  // Never persist agreement acceptance — re-confirm after login.
  delete raw.agreement_accepted;
  return sanitizeFields(raw);
}

export function savePartnerApplicationDraft(input: {
  fields: Record<string, string>;
  returnPath: string;
  pendingRestore?: boolean;
}): PartnerApplicationDraft {
  const draft: PartnerApplicationDraft = {
    version: 1,
    savedAt: new Date().toISOString(),
    pendingRestore: input.pendingRestore ?? true,
    returnPath: input.returnPath,
    fields: sanitizeFields(input.fields),
  };
  if (getSessionStorage()) {
    getSessionStorage()!.setItem(PARTNER_APPLICATION_DRAFT_KEY, JSON.stringify(draft));
  }
  return draft;
}

export function loadPartnerApplicationDraft(): PartnerApplicationDraft | null {
  const storage = getSessionStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(PARTNER_APPLICATION_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PartnerApplicationDraft;
    if (!parsed || parsed.version !== 1 || !parsed.fields) return null;
    parsed.fields = sanitizeFields(parsed.fields);
    // Defense in depth: strip any sensitive keys that slipped in.
    for (const key of SENSITIVE_FIELD_NAMES) {
      delete parsed.fields[key];
    }
    delete parsed.fields.agreement_accepted;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPartnerApplicationDraft(): void {
  getSessionStorage()?.removeItem(PARTNER_APPLICATION_DRAFT_KEY);
}

export function markPartnerApplicationDraftRestored(): void {
  const draft = loadPartnerApplicationDraft();
  if (!draft) return;
  draft.pendingRestore = false;
  getSessionStorage()?.setItem(
    PARTNER_APPLICATION_DRAFT_KEY,
    JSON.stringify(draft)
  );
}

export function partnerApplyLoginHref(returnPath: string): string {
  return `/login?next=${encodeURIComponent(returnPath)}`;
}

export function draftHasSensitiveData(draft: PartnerApplicationDraft | null): boolean {
  if (!draft) return false;
  return Object.keys(draft.fields).some((key) => SENSITIVE_FIELD_NAMES.has(key));
}
