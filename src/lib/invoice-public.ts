import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { buildInvoicePaymentBlocks } from "@/lib/invoice-payment-copy";
import {
  formatDateEastern,
  formatLocalDateStringEastern,
} from "@/lib/datetime-eastern";
import { invoiceTaxShortLabel } from "@/lib/invoice-tax";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidPublicInvoiceToken(token: string): boolean {
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

function formatJobServiceAddressLines(job: {
  property_address_line_1?: string | null;
  property_address_line_2?: string | null;
  property_city?: string | null;
  property_province?: string | null;
  property_postal_code?: string | null;
}): string[] {
  const street = [job.property_address_line_1, job.property_address_line_2]
    .filter(Boolean)
    .join(", ");
  const cityLine = [job.property_city, job.property_province, job.property_postal_code]
    .filter(Boolean)
    .join(", ");
  return [street, cityLine].filter((s) => s.trim().length > 0);
}

export type PublicInvoicePageData = {
  token: string;
  invoiceNumberLabel: string;
  issueDateLabel: string;
  dueDateLabel: string | null;
  jobTitle: string;
  taxRateLabel: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  depositCredited: number;
  /** Contractor-recorded payments toward balance (excludes deposit). */
  amountPaidTotal: number;
  balanceDue: number;
  lineItems: { description: string; amount: number; quantity: number }[];
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
    serviceAddressLines: string[];
  };
  paymentInstructions: string;
  paymentContactLines: string[];
  eTransferEmail: string | null;
  notes: string | null;
  hasPdf: boolean;
};

type ProfileJoin = {
  business_name: string | null;
  contractor_name: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  e_transfer_email: string | null;
  default_contract_payment_terms: string | null;
  business_contact_email: string | null;
};

type CustomerJoin = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
};

type JobJoin = {
  title: string | null;
  property_address_line_1: string | null;
  property_address_line_2: string | null;
  property_city: string | null;
  property_province: string | null;
  property_postal_code: string | null;
  customers: CustomerJoin | CustomerJoin[] | null;
};

function unwrapOne<T>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null;
  return Array.isArray(x) ? (x[0] ?? null) : x;
}

/**
 * Load invoice + contractor + customer for the public page (service role; token is the secret).
 */
export async function fetchPublicInvoicePageData(
  token: string
): Promise<PublicInvoicePageData | null> {
  if (!isValidPublicInvoiceToken(token)) return null;
  const admin = createServiceRoleClient();
  if (!admin) return null;

  const { data: row, error } = await admin
    .from("invoices")
    .select(
      `
      id,
      invoice_number,
      subtotal,
      tax_amount,
      total,
      deposit_credited,
      amount_paid_total,
      balance_due,
      due_date,
      notes,
      line_items,
      invoice_pdf_path,
      created_at,
      public_token,
      jobs (
        title,
        property_address_line_1,
        property_address_line_2,
        property_city,
        property_province,
        property_postal_code,
        customers (
          full_name,
          email,
          phone,
          address_line_1,
          address_line_2,
          city,
          province,
          postal_code
        )
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
        e_transfer_email,
        default_contract_payment_terms,
        business_contact_email
      )
    `
    )
    .eq("public_token", token.trim())
    .maybeSingle();

  if (error || !row) return null;

  const profile = unwrapOne(row.profiles as ProfileJoin | ProfileJoin[] | null);
  const job = unwrapOne(row.jobs as JobJoin | JobJoin[] | null);
  if (!profile) return null;

  const contractorEmail = profile.business_contact_email?.trim() || null;

  const customer = unwrapOne(job?.customers ?? null);
  const province = job?.property_province ?? null;
  const taxRateLabel = invoiceTaxShortLabel(province);

  const bizName = profile.business_name?.trim() || "Contractor";
  const { paymentInstructions, paymentContactLines } = buildInvoicePaymentBlocks(
    profile,
    bizName,
    contractorEmail
  );

  const customerName = customer?.full_name?.trim() || "Customer";
  const serviceAddressLines = job ? formatJobServiceAddressLines(job) : [];

  const rawLineItems = row.line_items;
  const lineItems: { description: string; amount: number; quantity: number }[] =
    Array.isArray(rawLineItems)
      ? (rawLineItems as Record<string, unknown>[]).map((item) => ({
          description: String(item.description ?? ""),
          amount: Number(item.amount ?? 0),
          quantity: Math.max(1, Number(item.quantity ?? 1) || 1),
        }))
      : [];

  const dueRaw = (row.due_date as string | null)?.trim() || null;
  const invoiceNumberLabel =
    (row.invoice_number as string | null)?.trim() ||
    `Invoice ${String(row.id).slice(0, 8)}`;

  const subtotal = Number(row.subtotal);
  const taxAmount = Number(row.tax_amount);
  const total = Number(row.total);
  const depositCredited = Number(row.deposit_credited ?? 0);
  const amountPaidTotal = Number(row.amount_paid_total ?? 0);
  const balanceDue = Number(
    row.balance_due ?? Math.max(0, total - depositCredited - amountPaidTotal)
  );

  const pdfPath = (row.invoice_pdf_path as string | null)?.trim() || null;

  return {
    token: token.trim(),
    invoiceNumberLabel,
    issueDateLabel: formatDateEastern(String(row.created_at), {
      dateStyle: "long",
    }),
    dueDateLabel: dueRaw
      ? formatLocalDateStringEastern(dueRaw, { dateStyle: "long" })
      : null,
    jobTitle: String(job?.title ?? "Job"),
    taxRateLabel,
    subtotal,
    taxAmount,
    total,
    depositCredited,
    amountPaidTotal,
    balanceDue,
    lineItems,
    contractor: {
      businessName: bizName,
      contactName: profile.contractor_name?.trim() || null,
      phone: profile.phone?.trim() || null,
      email: contractorEmail,
      addressLines: formatProfileAddressLines(profile),
    },
    customer: {
      name: customerName,
      email: customer?.email?.trim() || null,
      phone: customer?.phone?.trim() || null,
      serviceAddressLines,
    },
    paymentInstructions,
    paymentContactLines,
    eTransferEmail: profile.e_transfer_email?.trim() || null,
    notes: typeof row.notes === "string" ? row.notes.trim() || null : null,
    hasPdf: Boolean(pdfPath),
  };
}

export async function fetchInvoicePdfByPublicToken(
  token: string
): Promise<{ path: string; filename: string } | null> {
  if (!isValidPublicInvoiceToken(token)) return null;
  const admin = createServiceRoleClient();
  if (!admin) return null;

  const { data: row, error } = await admin
    .from("invoices")
    .select("id, invoice_number, invoice_pdf_path")
    .eq("public_token", token.trim())
    .maybeSingle();

  if (error || !row) return null;
  const path = (row.invoice_pdf_path as string | null)?.trim();
  if (!path) return null;

  const num =
    (row.invoice_number as string | null)?.trim() ||
    `invoice-${String(row.id).slice(0, 8)}`;
  const safe = num.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "") || "invoice";
  return { path, filename: `${safe}.pdf` };
}

/** First public page view only; ignores failures. */
export async function markPublicInvoiceViewedOnce(token: string): Promise<void> {
  if (!isValidPublicInvoiceToken(token)) return;
  const admin = createServiceRoleClient();
  if (!admin) return;
  await admin
    .from("invoices")
    .update({ viewed_at: new Date().toISOString() })
    .eq("public_token", token.trim())
    .is("viewed_at", null);
}
