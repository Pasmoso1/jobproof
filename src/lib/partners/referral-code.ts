import { randomBytes } from "node:crypto";

/** Generate a short, readable referral code (e.g. JP-A3F9K2). */
export function generatePartnerReferralCode(): string {
  const raw = randomBytes(4).toString("hex").toUpperCase();
  return `JP-${raw.slice(0, 6)}`;
}

export function normalizePartnerReferralCode(raw: string | null | undefined): string | null {
  const s = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!s) return null;
  if (!/^JP-[A-Z0-9]{4,12}$/i.test(s) && !/^[A-Z0-9-]{4,20}$/i.test(s)) {
    // Allow stored codes that may vary slightly; reject empty / tiny strings.
    if (s.length < 4 || s.length > 24) return null;
  }
  return s;
}
