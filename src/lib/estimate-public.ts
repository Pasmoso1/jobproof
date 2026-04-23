import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { formatDateEastern, formatLocalDateStringEastern } from "@/lib/datetime-eastern";
import { invoiceTaxShortLabel } from "@/lib/invoice-tax";
import {
  deriveEstimateDisplayStatus,
  isEstimateOpenForCustomerResponse,
} from "@/lib/estimate-status";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidPublicEstimateToken(token: string): boolean {
  return typeof token === "string" && UUID_REGEX.test(token.trim());
}

function formatProfileAddressLines(p: {
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
}): string[] {
  const street = [p.address_line_1, p.address_line_2].filter(Boolean).join(", ");
  const cityLine = [p.city, p.province, p.postal_code].filter(Boolean).join(", ");
  return [street, cityLine].filter((s) => s.trim().length > 0);
}

function formatEstimatePropertyLines(e: {
  property_address_line_1: string | null;
  property_address_line_2: string | null;
  property_city: string | null;
  property_province: string | null;
  property_postal_code: string | null;
}): string[] {
  const street = [e.property_address_line_1, e.property_address_line_2]
    .filter(Boolean)
    .join(", ");
  const cityLine = [e.property_city, e.property_province, e.property_postal_code]
    .filter(Boolean)
    .join(", ");
  return [street, cityLine].filter((s) => s.trim().length > 0);
}

type ProfileJoin = {
  business_name: string | null;
  contractor_name: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  business_contact_email: string | null;
};

type CustomerJoin = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

function unwrapOne<T>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null;
  return Array.isArray(x) ? (x[0] ?? null) : x;
}

export type PublicEstimatePageData = {
  token: string;
  estimateNumberLabel: string;
  title: string;
  issueDateLabel: string;
  expiryDateLabel: string | null;
  expiryYmd: string | null;
  scopeOfWork: string;
  subtotal: number;
  taxAmount: number;
  taxRateLabel: string;
  total: number;
  depositAmount: number | null;
  notes: string | null;
  dbStatus: string;
  displayStatus: ReturnType<typeof deriveEstimateDisplayStatus>;
  canRespond: boolean;
  acceptedAt: string | null;
  declinedAt: string | null;
  jobLinked: boolean;
  contractor: {
    businessName: string;
    contactName: string | null;
    phone: string | null;
    email: string | null;
    addressLines: string[];
  };
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
  };
  propertyAddressLines: string[];
  hasPdf: boolean;
};

export async function fetchPublicEstimatePageData(
  token: string
): Promise<PublicEstimatePageData | null> {
  if (!isValidPublicEstimateToken(token)) return null;
  const admin = createServiceRoleClient();
  if (!admin) return null;

  const { data: row, error } = await admin
    .from("estimates")
    .select(
      `
      id,
      title,
      scope_of_work,
      property_address_line_1,
      property_address_line_2,
      property_city,
      property_province,
      property_postal_code,
      subtotal,
      tax_amount,
      total,
      deposit_amount,
      expiry_date,
      notes,
      status,
      estimate_number,
      created_at,
      accepted_at,
      declined_at,
      job_id,
      estimate_pdf_path,
      public_token,
      customers (
        full_name,
        email,
        phone
      ),
      profiles (
        business_name,
        contractor_name,
        phone,
        address_line_1,
        address_line_2,
        city,
        province,
        postal_code,
        business_contact_email
      )
    `
    )
    .eq("public_token", token.trim())
    .maybeSingle();

  if (error || !row) return null;

  const status = String(row.status ?? "");
  if (status === "draft") return null;

  const profile = unwrapOne(row.profiles as ProfileJoin | ProfileJoin[] | null);
  if (!profile) return null;

  const customer = unwrapOne(row.customers as CustomerJoin | CustomerJoin[] | null);
  const province = (row.property_province as string | null)?.trim() || null;
  const taxRateLabel = invoiceTaxShortLabel(province);

  const contractorEmail =
    profile.business_contact_email?.trim() || null;

  const expRaw = (row.expiry_date as string | null)?.trim() || null;
  const displayStatus = deriveEstimateDisplayStatus(status, expRaw);
  const canRespond = isEstimateOpenForCustomerResponse(status, expRaw);

  const pdfPath = (row.estimate_pdf_path as string | null)?.trim() || null;

  return {
    token: token.trim(),
    estimateNumberLabel:
      (row.estimate_number as string | null)?.trim() ||
      `Estimate ${String(row.id).slice(0, 8)}`,
    title: String(row.title ?? "").trim() || "Estimate",
    issueDateLabel: formatDateEastern(String(row.created_at), { dateStyle: "long" }),
    expiryDateLabel: expRaw
      ? formatLocalDateStringEastern(expRaw, { dateStyle: "long" })
      : null,
    expiryYmd: expRaw,
    scopeOfWork: String(row.scope_of_work ?? "").trim(),
    subtotal: Number(row.subtotal),
    taxAmount: Number(row.tax_amount),
    taxRateLabel,
    total: Number(row.total),
    depositAmount:
      row.deposit_amount != null && Number(row.deposit_amount) > 0
        ? Number(row.deposit_amount)
        : null,
    notes: typeof row.notes === "string" ? row.notes.trim() || null : null,
    dbStatus: status,
    displayStatus,
    canRespond,
    acceptedAt: (row.accepted_at as string | null) ?? null,
    declinedAt: (row.declined_at as string | null) ?? null,
    jobLinked: Boolean(row.job_id),
    contractor: {
      businessName: profile.business_name?.trim() || "Contractor",
      contactName: profile.contractor_name?.trim() || null,
      phone: profile.phone?.trim() || null,
      email: contractorEmail,
      addressLines: formatProfileAddressLines(profile),
    },
    customer: {
      name: customer?.full_name?.trim() || "Customer",
      email: customer?.email?.trim() || null,
      phone: customer?.phone?.trim() || null,
    },
    propertyAddressLines: formatEstimatePropertyLines(
      row as Parameters<typeof formatEstimatePropertyLines>[0]
    ),
    hasPdf: Boolean(pdfPath),
  };
}

export async function fetchEstimatePdfByPublicToken(
  token: string
): Promise<{ path: string; filename: string } | null> {
  if (!isValidPublicEstimateToken(token)) return null;
  const admin = createServiceRoleClient();
  if (!admin) return null;

  const { data: row, error } = await admin
    .from("estimates")
    .select("id, estimate_number, estimate_pdf_path")
    .eq("public_token", token.trim())
    .maybeSingle();

  if (error || !row) return null;
  const path = (row.estimate_pdf_path as string | null)?.trim();
  if (!path) return null;

  const num =
    (row.estimate_number as string | null)?.trim() ||
    `estimate-${String(row.id).slice(0, 8)}`;
  const safe = num.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "") || "estimate";
  return { path, filename: `${safe}.pdf` };
}

export async function markPublicEstimateViewedOnce(token: string): Promise<void> {
  if (!isValidPublicEstimateToken(token)) return;
  const admin = createServiceRoleClient();
  if (!admin) return;
  await admin
    .from("estimates")
    .update({
      viewed_at: new Date().toISOString(),
      status: "viewed",
    })
    .eq("public_token", token.trim())
    .eq("status", "sent")
    .is("viewed_at", null);
}

export type PublicEstimateResponseResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "closed" | "expired" | "already_answered" };

export async function acceptPublicEstimateByToken(
  token: string
): Promise<PublicEstimateResponseResult> {
  if (!isValidPublicEstimateToken(token)) return { ok: false, reason: "not_found" };
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, reason: "not_found" };

  const { data: row } = await admin
    .from("estimates")
    .select("id, status, expiry_date")
    .eq("public_token", token.trim())
    .maybeSingle();

  if (!row) return { ok: false, reason: "not_found" };
  const status = String(row.status);
  if (status === "accepted" || status === "declined") {
    return { ok: false, reason: "already_answered" };
  }
  if (status !== "sent" && status !== "viewed") {
    return { ok: false, reason: "closed" };
  }
  const exp = (row.expiry_date as string | null)?.trim() ?? "";
  if (!isEstimateOpenForCustomerResponse(status, exp || null)) {
    return { ok: false, reason: "expired" };
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await admin
    .from("estimates")
    .update({
      status: "accepted",
      accepted_at: now,
      responded_at: now,
    })
    .eq("id", row.id)
    .in("status", ["sent", "viewed"])
    .select("id")
    .maybeSingle();

  if (error || !updated) return { ok: false, reason: "already_answered" };
  return { ok: true };
}

export async function declinePublicEstimateByToken(
  token: string
): Promise<PublicEstimateResponseResult> {
  if (!isValidPublicEstimateToken(token)) return { ok: false, reason: "not_found" };
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, reason: "not_found" };

  const { data: row } = await admin
    .from("estimates")
    .select("id, status, expiry_date")
    .eq("public_token", token.trim())
    .maybeSingle();

  if (!row) return { ok: false, reason: "not_found" };
  const status = String(row.status);
  if (status === "accepted" || status === "declined") {
    return { ok: false, reason: "already_answered" };
  }
  if (status !== "sent" && status !== "viewed") {
    return { ok: false, reason: "closed" };
  }
  const exp = (row.expiry_date as string | null)?.trim() ?? "";
  if (!isEstimateOpenForCustomerResponse(status, exp || null)) {
    return { ok: false, reason: "expired" };
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await admin
    .from("estimates")
    .update({
      status: "declined",
      declined_at: now,
      responded_at: now,
    })
    .eq("id", row.id)
    .in("status", ["sent", "viewed"])
    .select("id")
    .maybeSingle();

  if (error || !updated) return { ok: false, reason: "already_answered" };
  return { ok: true };
}
