import { validateCanadianPhone } from "@/lib/canada/phone";
import { normalizeCanadianProvince } from "@/lib/canada/provinces";
import { isValidCanadianPostalCode } from "@/lib/canada/postal-code";

/** Shared client + server validation for business profile (onboarding + settings). */

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export type BusinessProfileInput = {
  business_name: string;
  account_email: string;
  phone: string;
  address_line_1: string;
  city: string;
  province: string;
  postal_code: string;
};

export function validateBusinessProfileFields(
  input: Partial<BusinessProfileInput>
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!input.business_name?.trim()) {
    errors.business_name = "Business name is required.";
  }

  const email = input.account_email?.trim() ?? "";
  if (!email) {
    errors.account_email = "A valid email is required.";
  } else if (!EMAIL_REGEX.test(email)) {
    errors.account_email = "Enter a valid email address.";
  }

  const phoneErr = validateCanadianPhone(input.phone, {
    required: true,
    label: "phone number",
  });
  if (phoneErr) errors.phone = phoneErr;

  if (!input.address_line_1?.trim()) {
    errors.address_line_1 = "Address line 1 is required.";
  }

  if (!input.city?.trim()) {
    errors.city = "City is required.";
  }

  if (!normalizeCanadianProvince(input.province)) {
    errors.province = "Select a Canadian province or territory.";
  }

  if (!input.postal_code?.trim()) {
    errors.postal_code = "Postal code is required.";
  } else if (!isValidCanadianPostalCode(input.postal_code)) {
    errors.postal_code = "Enter a valid Canadian postal code (e.g. A1A 1A1).";
  }

  return errors;
}

export const BUSINESS_NAME_MAX_LENGTH = 120;

/** Formal documents (contracts, change orders, invoices, sent estimates) need full details. */
export const BUSINESS_DETAILS_REQUIRED_MESSAGE =
  "Add your business phone and address before sending. They appear on the documents your customers receive. Go to Settings → Business.";

/** Initial onboarding only asks for the business name (plus primary trade, validated separately). */
export function validateOnboardingBusinessName(name: string | null | undefined): string | null {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return "Business name is required.";
  if (trimmed.length > BUSINESS_NAME_MAX_LENGTH) {
    return `Business name must be ${BUSINESS_NAME_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

export type MissingBusinessDetail = "business_name" | "phone" | "address";

export const MISSING_BUSINESS_DETAIL_LABELS: Record<MissingBusinessDetail, string> = {
  business_name: "Business name",
  phone: "Business phone",
  address: "Business address",
};

/**
 * Details still needed before formal customer documents (contracts, change orders, invoices,
 * sent estimates) can be issued. Empty when the profile is complete.
 */
export function getMissingBusinessDetails(
  profile:
    | {
        business_name?: string | null;
        phone?: string | null;
        address_line_1?: string | null;
        city?: string | null;
        province?: string | null;
        postal_code?: string | null;
      }
    | null
    | undefined
): MissingBusinessDetail[] {
  const errors = validateBusinessProfileFields({
    business_name: profile?.business_name ?? "",
    phone: profile?.phone ?? "",
    address_line_1: profile?.address_line_1 ?? "",
    city: profile?.city ?? "",
    province: profile?.province ?? "",
    postal_code: profile?.postal_code ?? "",
  });
  const missing: MissingBusinessDetail[] = [];
  if (errors.business_name) missing.push("business_name");
  if (errors.phone) missing.push("phone");
  if (errors.address_line_1 || errors.city || errors.province || errors.postal_code) {
    missing.push("address");
  }
  return missing;
}

/** True when all required business fields + auth email satisfy validation (formal documents). */
export function isBusinessProfileCompleteForApp(input: {
  business_name: string | null | undefined;
  account_email: string;
  phone: string | null | undefined;
  address_line_1: string | null | undefined;
  city: string | null | undefined;
  province: string | null | undefined;
  postal_code: string | null | undefined;
}): boolean {
  const errs = validateBusinessProfileFields({
    business_name: input.business_name ?? "",
    account_email: input.account_email,
    phone: input.phone ?? "",
    address_line_1: input.address_line_1 ?? "",
    city: input.city ?? "",
    province: input.province ?? "",
    postal_code: input.postal_code ?? "",
  });
  return Object.keys(errs).length === 0;
}
