import { MAX_QUOTE_REQUEST_PHOTOS } from "@/lib/quote-requests/constants";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validatePublicQuoteRequestFields(input: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  propertyAddress: string;
  projectType: string;
  description: string;
  photoCount: number;
}): { ok: true } | { ok: false; error: string } {
  if (!input.customerName.trim()) {
    return { ok: false, error: "Name is required." };
  }
  if (!input.customerEmail.trim() || !EMAIL_PATTERN.test(input.customerEmail.trim())) {
    return { ok: false, error: "A valid email is required." };
  }
  if (!input.propertyAddress.trim()) {
    return { ok: false, error: "Property address is required." };
  }
  if (!input.projectType.trim()) {
    return { ok: false, error: "Project type is required." };
  }
  if (!input.description.trim()) {
    return { ok: false, error: "Description is required." };
  }
  if (input.description.trim().length > 5000) {
    return { ok: false, error: "Description must be 5,000 characters or less." };
  }
  if (input.photoCount > MAX_QUOTE_REQUEST_PHOTOS) {
    return { ok: false, error: `You can upload up to ${MAX_QUOTE_REQUEST_PHOTOS} photos.` };
  }
  return { ok: true };
}
