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

  if (!input.phone?.trim()) {
    errors.phone = "Phone is required.";
  }

  if (!input.address_line_1?.trim()) {
    errors.address_line_1 = "Address line 1 is required.";
  }

  if (!input.city?.trim()) {
    errors.city = "City is required.";
  }

  if (!input.province?.trim()) {
    errors.province = "Province is required.";
  }

  if (!input.postal_code?.trim()) {
    errors.postal_code = "Postal code is required.";
  }

  return errors;
}

/** True when all required business fields + auth email satisfy validation (onboarding gate, middleware). */
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
