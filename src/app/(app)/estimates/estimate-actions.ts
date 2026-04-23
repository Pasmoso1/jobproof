"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isBusinessProfileCompleteForApp } from "@/lib/validation/business-profile";
import {
  parsePositiveContractPrice,
  validateCustomerEmail,
  validateCustomerPhone,
  validateJobEstimatedScheduleDates,
  validateScopeOfWork,
  validateTrade,
} from "@/lib/validation/job-create";
import { defaultTaxRateForNewFinancials } from "@/lib/tax/canada";
import { formatDateEastern, formatLocalDateStringEastern, getTodayYmdEastern } from "@/lib/datetime-eastern";
import { invoiceTaxShortLabel } from "@/lib/invoice-tax";
import { resolvePublicAppOrigin } from "@/lib/app-origin";
import { resolveContractorContactEmail } from "@/lib/contractor-contact-email";
import { computeEstimateTotals } from "@/lib/estimate-pricing";
import { deriveEstimateDisplayStatus } from "@/lib/estimate-status";
import { buildEstimatePdf } from "@/lib/estimate-pdf";
import { sendEstimateEmail } from "@/lib/delivery-service";
import { generateEstimateNumber } from "@/lib/estimate-number";
import { createCustomer } from "@/app/(app)/actions";

function unwrapCustomerJoin(
  x: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null
): { full_name: string | null; email: string | null } | null {
  if (x == null) return null;
  return Array.isArray(x) ? (x[0] ?? null) : x;
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

function formatEstimatePropertyLinesForEmail(e: {
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

export type EstimateListRow = {
  id: string;
  estimate_number: string;
  title: string;
  status: string;
  created_at: string;
  expiry_date: string | null;
  sent_at: string | null;
  job_id: string | null;
  customer: { full_name: string | null; email: string | null } | null;
  displayStatus: ReturnType<typeof deriveEstimateDisplayStatus>;
};

export async function getEstimatesList(): Promise<EstimateListRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!profile) return [];

  const { data: rows } = await supabase
    .from("estimates")
    .select(
      `
      id,
      estimate_number,
      title,
      status,
      created_at,
      expiry_date,
      sent_at,
      job_id,
      customers ( full_name, email )
    `
    )
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });

  const today = getTodayYmdEastern();
  return (rows ?? []).map((r) => {
    const cust = unwrapCustomerJoin(
      r.customers as { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null
    );
    return {
      id: r.id as string,
      estimate_number: String(r.estimate_number ?? ""),
      title: String(r.title ?? ""),
      status: String(r.status ?? "draft"),
      created_at: String(r.created_at ?? ""),
      expiry_date: (r.expiry_date as string | null) ?? null,
      sent_at: (r.sent_at as string | null) ?? null,
      job_id: (r.job_id as string | null) ?? null,
      customer: cust
        ? { full_name: cust.full_name ?? null, email: cust.email ?? null }
        : null,
      displayStatus: deriveEstimateDisplayStatus(
        String(r.status ?? "draft"),
        (r.expiry_date as string | null) ?? null,
        today
      ),
    };
  });
}

export async function getEstimateAwaitingResponseCount(): Promise<number> {
  const list = await getEstimatesList();
  return list.filter((e) => e.displayStatus === "sent" || e.displayStatus === "viewed").length;
}

export type EstimateDetail = {
  id: string;
  profile_id: string;
  customer_id: string | null;
  job_id: string | null;
  estimate_number: string;
  title: string;
  scope_of_work: string | null;
  property_address_line_1: string | null;
  property_address_line_2: string | null;
  property_city: string | null;
  property_province: string | null;
  property_postal_code: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  deposit_amount: number | null;
  expiry_date: string | null;
  notes: string | null;
  status: string;
  public_token: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  created_at: string;
  customers: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
  } | null;
  displayStatus: ReturnType<typeof deriveEstimateDisplayStatus>;
};

export async function getEstimateById(estimateId: string): Promise<EstimateDetail | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!profile) return null;

  const { data: row, error } = await supabase
    .from("estimates")
    .select(
      `
      *,
      customers ( id, full_name, email, phone )
    `
    )
    .eq("id", estimateId)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (error || !row) return null;

  const cust = row.customers as EstimateDetail["customers"];
  const today = getTodayYmdEastern();
  return {
    id: row.id as string,
    profile_id: row.profile_id as string,
    customer_id: (row.customer_id as string | null) ?? null,
    job_id: (row.job_id as string | null) ?? null,
    estimate_number: String(row.estimate_number ?? ""),
    title: String(row.title ?? ""),
    scope_of_work: (row.scope_of_work as string | null) ?? null,
    property_address_line_1: (row.property_address_line_1 as string | null) ?? null,
    property_address_line_2: (row.property_address_line_2 as string | null) ?? null,
    property_city: (row.property_city as string | null) ?? null,
    property_province: (row.property_province as string | null) ?? null,
    property_postal_code: (row.property_postal_code as string | null) ?? null,
    subtotal: Number(row.subtotal),
    tax_rate: Number(row.tax_rate),
    tax_amount: Number(row.tax_amount),
    total: Number(row.total),
    deposit_amount:
      row.deposit_amount != null && Number(row.deposit_amount) > 0
        ? Number(row.deposit_amount)
        : null,
    expiry_date: (row.expiry_date as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    status: String(row.status ?? "draft"),
    public_token: (row.public_token as string | null) ?? null,
    sent_at: (row.sent_at as string | null) ?? null,
    viewed_at: (row.viewed_at as string | null) ?? null,
    accepted_at: (row.accepted_at as string | null) ?? null,
    declined_at: (row.declined_at as string | null) ?? null,
    created_at: String(row.created_at ?? ""),
    customers: cust
      ? {
          id: String(cust.id),
          full_name: String(cust.full_name ?? ""),
          email: cust.email ?? null,
          phone: cust.phone ?? null,
        }
      : null,
    displayStatus: deriveEstimateDisplayStatus(
      String(row.status ?? "draft"),
      (row.expiry_date as string | null) ?? null,
      today
    ),
  };
}

async function resolveCustomerIdForEstimate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
  formData: FormData
): Promise<{ customerId: string } | { error: string }> {
  const useNew = String(formData.get("use_new_customer") ?? "") === "1";
  if (!useNew) {
    const customerId = String(formData.get("customer_id") ?? "").trim();
    if (!customerId) return { error: "Please select a customer." };
    const { data: c } = await supabase
      .from("customers")
      .select("id")
      .eq("id", customerId)
      .eq("profile_id", profileId)
      .maybeSingle();
    if (!c) return { error: "Customer not found." };
    const phoneOverride = String(formData.get("existing_customer_phone") ?? "").trim();
    if (phoneOverride) {
      await supabase
        .from("customers")
        .update({ phone: phoneOverride })
        .eq("id", customerId)
        .eq("profile_id", profileId);
    }
    return { customerId };
  }

  const fd = new FormData();
  fd.set("full_name", String(formData.get("customer_full_name") ?? "").trim());
  fd.set("email", String(formData.get("customer_email") ?? "").trim());
  fd.set("phone", String(formData.get("customer_phone") ?? "").trim());
  const res = await createCustomer(fd);
  if ("error" in res && res.error) return { error: res.error };
  if (!("customerId" in res)) return { error: "Could not create customer." };
  return { customerId: res.customerId };
}

type ParsedEstimateFields = {
  title: string;
  scopeOfWork: string;
  propertyAddressLine1: string | null;
  propertyAddressLine2: string | null;
  propertyCity: string | null;
  propertyProvince: string | null;
  propertyPostalCode: string | null;
  notes: string | null;
  expiryDate: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  depositAmount: number | null;
};

function parseEstimateForm(
  formData: FormData,
  profileProvince: string | null
): ParsedEstimateFields | { error: string } | { fieldErrors: Record<string, string> } {
  const title = String(formData.get("title") ?? "").trim();
  const scopeOfWork = String(formData.get("scope_of_work") ?? "").trim();
  const propertyAddressLine1 = String(formData.get("property_address_line_1") ?? "").trim() || null;
  const propertyAddressLine2 = String(formData.get("property_address_line_2") ?? "").trim() || null;
  const propertyCity = String(formData.get("property_city") ?? "").trim() || null;
  const propertyProvince = String(formData.get("property_province") ?? "").trim() || null;
  const propertyPostalCode = String(formData.get("property_postal_code") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const expiryDate = String(formData.get("expiry_date") ?? "").trim() || null;

  const subtotalRes = parsePositiveContractPrice(formData.get("subtotal"));
  if (!subtotalRes.ok) {
    return { fieldErrors: { subtotal: subtotalRes.message } };
  }

  const taxRateRaw = formData.get("tax_rate");
  const taxRateParsed =
    taxRateRaw != null && String(taxRateRaw).trim() !== ""
      ? parseFloat(String(taxRateRaw))
      : NaN;
  const fallbackTax = defaultTaxRateForNewFinancials(
    profileProvince,
    propertyProvince
  ).taxRate;
  const taxRate =
    Number.isFinite(taxRateParsed) && taxRateParsed >= 0 ? taxRateParsed : fallbackTax;

  const { taxAmount, total } = computeEstimateTotals(subtotalRes.value, taxRate);

  const depositRaw = formData.get("deposit_amount");
  const depositParsed = depositRaw ? parseFloat(String(depositRaw)) : NaN;
  const depositAmount =
    Number.isFinite(depositParsed) && depositParsed > 0 ? depositParsed : null;

  const scopeErr = validateScopeOfWork(scopeOfWork);
  if (scopeErr) return { fieldErrors: { scope_of_work: scopeErr } };

  if (!title) return { error: "Title is required." };
  if (!propertyAddressLine1) return { error: "Property address line 1 is required." };
  if (!propertyCity) return { error: "Property city is required." };
  if (!propertyProvince) return { error: "Property province is required." };

  return {
    title,
    scopeOfWork,
    propertyAddressLine1,
    propertyAddressLine2,
    propertyCity,
    propertyProvince,
    propertyPostalCode,
    notes,
    expiryDate: expiryDate || null,
    subtotal: subtotalRes.value,
    taxRate,
    taxAmount,
    total,
    depositAmount,
  };
}

export async function createEstimate(
  formData: FormData
): Promise<
  | { estimateId: string }
  | { error: string }
  | { fieldErrors: Record<string, string> }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, province")
    .eq("user_id", user.id)
    .single();
  if (!profile) redirect("/login");

  const parsed = parseEstimateForm(formData, profile.province as string | null);
  if ("error" in parsed) return { error: parsed.error };
  if ("fieldErrors" in parsed) return { fieldErrors: parsed.fieldErrors };

  const custRes = await resolveCustomerIdForEstimate(supabase, profile.id, formData);
  if ("error" in custRes) return { error: custRes.error };

  const { data: custRow } = await supabase
    .from("customers")
    .select("email, phone")
    .eq("id", custRes.customerId)
    .single();
  const emErr = validateCustomerEmail(custRow?.email ?? "");
  if (emErr) return { fieldErrors: { customer_email: emErr } };
  const phErr = validateCustomerPhone(custRow?.phone ?? "");
  if (phErr) return { fieldErrors: { customer_phone: phErr } };

  const { data: ins, error } = await supabase
    .from("estimates")
    .insert({
      profile_id: profile.id,
      customer_id: custRes.customerId,
      estimate_number: generateEstimateNumber(),
      title: parsed.title,
      scope_of_work: parsed.scopeOfWork,
      property_address_line_1: parsed.propertyAddressLine1,
      property_address_line_2: parsed.propertyAddressLine2,
      property_city: parsed.propertyCity,
      property_province: parsed.propertyProvince,
      property_postal_code: parsed.propertyPostalCode,
      subtotal: parsed.subtotal,
      tax_rate: parsed.taxRate,
      tax_amount: parsed.taxAmount,
      total: parsed.total,
      deposit_amount: parsed.depositAmount,
      expiry_date: parsed.expiryDate,
      notes: parsed.notes,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/estimates");
  revalidatePath("/dashboard");
  return { estimateId: ins.id as string };
}

export async function updateEstimateDraft(
  estimateId: string,
  formData: FormData
): Promise<{ ok: true } | { error: string } | { fieldErrors: Record<string, string> }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, province")
    .eq("user_id", user.id)
    .single();
  if (!profile) redirect("/login");

  const { data: existing } = await supabase
    .from("estimates")
    .select("id, status, profile_id, customer_id")
    .eq("id", estimateId)
    .single();

  if (!existing || existing.profile_id !== profile.id) return { error: "Estimate not found." };
  if (String(existing.status) !== "draft") {
    return { error: "Only draft estimates can be edited." };
  }

  const parsed = parseEstimateForm(formData, profile.province as string | null);
  if ("error" in parsed) return { error: parsed.error };
  if ("fieldErrors" in parsed) return { fieldErrors: parsed.fieldErrors };

  const custRes = await resolveCustomerIdForEstimate(supabase, profile.id, formData);
  if ("error" in custRes) return { error: custRes.error };

  const { data: custRow } = await supabase
    .from("customers")
    .select("email, phone")
    .eq("id", custRes.customerId)
    .single();
  const emErr = validateCustomerEmail(custRow?.email ?? "");
  if (emErr) return { fieldErrors: { customer_email: emErr } };
  const phErr = validateCustomerPhone(custRow?.phone ?? "");
  if (phErr) return { fieldErrors: { customer_phone: phErr } };

  const { error } = await supabase
    .from("estimates")
    .update({
      customer_id: custRes.customerId,
      title: parsed.title,
      scope_of_work: parsed.scopeOfWork,
      property_address_line_1: parsed.propertyAddressLine1,
      property_address_line_2: parsed.propertyAddressLine2,
      property_city: parsed.propertyCity,
      property_province: parsed.propertyProvince,
      property_postal_code: parsed.propertyPostalCode,
      subtotal: parsed.subtotal,
      tax_rate: parsed.taxRate,
      tax_amount: parsed.taxAmount,
      total: parsed.total,
      deposit_amount: parsed.depositAmount,
      expiry_date: parsed.expiryDate,
      notes: parsed.notes,
    })
    .eq("id", estimateId)
    .eq("profile_id", profile.id);

  if (error) return { error: error.message };
  revalidatePath("/estimates");
  revalidatePath(`/estimates/${estimateId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

async function buildAndStoreEstimatePdf(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  profile: Record<string, unknown>;
  userEmail: string;
  estimate: Record<string, unknown>;
  customer: { full_name: string | null; email: string | null; phone: string | null };
}): Promise<{ pdfBase64: string; filename: string; storagePath: string } | null> {
  const { supabase, profile, userEmail, estimate, customer } = params;
  const profileId = String(profile.id);
  const estimateId = String(estimate.id);
  const propertyProvince = (estimate.property_province as string | null)?.trim() || null;
  const taxLabel = invoiceTaxShortLabel(propertyProvince);
  const contractorContactEmail = resolveContractorContactEmail(
    profile as Parameters<typeof resolveContractorContactEmail>[0],
    userEmail
  );
  const bizName = String(profile.business_name ?? "").trim() || "Contractor";
  const estimateNumberLabel =
    String(estimate.estimate_number ?? "").trim() || `Estimate ${estimateId.slice(0, 8)}`;
  const issueDateFormatted = formatDateEastern(String(estimate.created_at));
  const expRaw = (estimate.expiry_date as string | null)?.trim() || null;
  const expiryDateLabel = expRaw
    ? formatLocalDateStringEastern(expRaw, { dateStyle: "long" })
    : null;

  const pdfBytes = await buildEstimatePdf({
    estimateNumberLabel,
    issueDateLabel: issueDateFormatted,
    expiryDateLabel,
    title: String(estimate.title ?? ""),
    contractor: {
      businessName: bizName,
      contactName: (profile.contractor_name as string | null)?.trim() || null,
      phone: (profile.phone as string | null)?.trim() || null,
      email: contractorContactEmail,
      addressLines: formatProfileAddressLines(
        profile as Parameters<typeof formatProfileAddressLines>[0]
      ),
    },
    customer: {
      name: customer.full_name?.trim() || "Customer",
      email: customer.email?.trim() || null,
      phone: customer.phone?.trim() || null,
    },
    propertyAddressLines: formatEstimatePropertyLinesForEmail(
      estimate as Parameters<typeof formatEstimatePropertyLinesForEmail>[0]
    ),
    scopeOfWork: String(estimate.scope_of_work ?? "").trim(),
    subtotal: Number(estimate.subtotal),
    taxLabel,
    taxAmount: Number(estimate.tax_amount),
    total: Number(estimate.total),
    depositAmount:
      estimate.deposit_amount != null && Number(estimate.deposit_amount) > 0
        ? Number(estimate.deposit_amount)
        : null,
    notes: typeof estimate.notes === "string" ? estimate.notes.trim() || null : null,
  });

  const pdfFilenameBase =
    estimateNumberLabel.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) ||
    "estimate";
  const filename = `${pdfFilenameBase}.pdf`;
  const storagePath = `${profileId}/${estimateId}.pdf`;

  const { error: uploadErr } = await supabase.storage
    .from("estimate-pdfs")
    .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: true });

  if (uploadErr) {
    console.error("[estimate] PDF upload failed:", uploadErr);
    return {
      pdfBase64: Buffer.from(pdfBytes).toString("base64"),
      filename,
      storagePath,
    };
  }

  await supabase.from("estimates").update({ estimate_pdf_path: storagePath }).eq("id", estimateId);

  return {
    pdfBase64: Buffer.from(pdfBytes).toString("base64"),
    filename,
    storagePath,
  };
}

export async function sendEstimate(
  estimateId: string
): Promise<{ ok: true; emailSent: boolean; emailError?: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, business_name, contractor_name, phone, address_line_1, address_line_2, city, province, postal_code, business_contact_email"
    )
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/login");

  if (
    !isBusinessProfileCompleteForApp({
      business_name: profile.business_name,
      account_email: user.email ?? "",
      phone: profile.phone,
      address_line_1: profile.address_line_1,
      city: profile.city,
      province: profile.province,
      postal_code: profile.postal_code,
    })
  ) {
    return {
      error:
        "Please complete your business profile before sending. Go to Settings → Business.",
    };
  }

  const { data: est, error: estErr } = await supabase
    .from("estimates")
    .select(
      `
      *,
      customers ( full_name, email, phone )
    `
    )
    .eq("id", estimateId)
    .eq("profile_id", profile.id)
    .single();

  if (estErr || !est) return { error: "Estimate not found." };
  if (String(est.status) !== "draft") {
    return { error: "Only draft estimates can be sent." };
  }

  const customer = est.customers as {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  const customerEmail = customer?.email?.trim() ?? "";
  const customerName = customer?.full_name?.trim() ?? "there";
  if (!customerEmail) {
    return { error: "Customer email is required before sending." };
  }

  const publicToken = randomUUID();
  const { error: tokErr } = await supabase
    .from("estimates")
    .update({ public_token: publicToken })
    .eq("id", estimateId);

  if (tokErr) return { error: tokErr.message };

  const { data: est2 } = await supabase
    .from("estimates")
    .select("*")
    .eq("id", estimateId)
    .single();

  if (!est2) return { error: "Estimate not found." };

  const pdfWrap = await buildAndStoreEstimatePdf({
    supabase,
    profile,
    userEmail: user.email ?? "",
    estimate: est2,
    customer: {
      full_name: customer?.full_name ?? null,
      email: customer?.email ?? null,
      phone: customer?.phone ?? null,
    },
  });

  const propertyProvince = (est2.property_province as string | null)?.trim() || null;
  const taxRateLabel = invoiceTaxShortLabel(propertyProvince);
  const bizName = profile.business_name?.trim() || "Your contractor";
  const contractorContactEmail = resolveContractorContactEmail(profile, user.email);
  const estimateNumberDisplay =
    String(est2.estimate_number ?? "").trim() || `Estimate ${estimateId.slice(0, 8)}`;
  const issueDateFormatted = formatDateEastern(est2.created_at as string);
  const expRaw = (est2.expiry_date as string | null)?.trim() || null;
  const expiryFormatted = expRaw
    ? formatLocalDateStringEastern(expRaw, { dateStyle: "long" })
    : null;

  const publicUrl = `${resolvePublicAppOrigin()}/estimate/${publicToken}`;

  const pdfAttachment = pdfWrap
    ? { filename: pdfWrap.filename, contentBase64: pdfWrap.pdfBase64 }
    : undefined;

  const sendResult = await sendEstimateEmail({
    toEmail: customerEmail,
    toName: customerName,
    estimateTitle: String(est2.title ?? "Project"),
    estimateNumber: estimateNumberDisplay,
    businessDisplayName: profile.business_name,
    replyToEmail: contractorContactEmail ?? user.email ?? null,
    publicEstimateUrl: publicUrl,
    contractor: {
      businessName: bizName,
      contactName: profile.contractor_name?.trim() || null,
      phone: profile.phone?.trim() || null,
      email: contractorContactEmail,
      addressLines: formatProfileAddressLines(profile),
    },
    issueDate: issueDateFormatted,
    expiryDate: expiryFormatted,
    subtotal: Number(est2.subtotal),
    taxAmount: Number(est2.tax_amount),
    taxRateLabel,
    total: Number(est2.total),
    suggestedDeposit:
      est2.deposit_amount != null && Number(est2.deposit_amount) > 0
        ? Number(est2.deposit_amount)
        : null,
    notes: typeof est2.notes === "string" ? est2.notes.trim() || null : null,
    pdfAttachment,
    deliveryLog: {
      profileId: profile.id as string,
      type: "estimate",
      relatedEntityId: estimateId,
    },
  });

  if (!sendResult.success) {
    await supabase.from("estimates").update({ public_token: null }).eq("id", estimateId);
    return {
      ok: true,
      emailSent: false,
      emailError:
        sendResult.error ??
        "Email could not be sent. Check Resend configuration and try again.",
    };
  }

  const sentAt = new Date().toISOString();
  await supabase
    .from("estimates")
    .update({ status: "sent", sent_at: sentAt })
    .eq("id", estimateId);

  revalidatePath("/estimates");
  revalidatePath(`/estimates/${estimateId}`);
  revalidatePath("/dashboard");
  return { ok: true, emailSent: true };
}

export async function resendEstimateEmail(
  estimateId: string
): Promise<{ emailSent: boolean; emailError?: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, business_name, contractor_name, phone, address_line_1, address_line_2, city, province, postal_code, business_contact_email"
    )
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/login");

  const { data: est2, error: estErr } = await supabase
    .from("estimates")
    .select(
      `
      *,
      customers ( full_name, email, phone )
    `
    )
    .eq("id", estimateId)
    .eq("profile_id", profile.id)
    .single();

  if (estErr || !est2) return { error: "Estimate not found." };
  const st = String(est2.status);
  if (st === "draft" || st === "accepted" || st === "declined") {
    return { error: "This estimate cannot be resent in its current state." };
  }
  const token = String(est2.public_token ?? "").trim();
  if (!token) return { error: "Missing public link for this estimate." };

  const customer = est2.customers as {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  const customerEmail = customer?.email?.trim() ?? "";
  const customerName = customer?.full_name?.trim() ?? "there";
  if (!customerEmail) return { error: "Customer email is missing." };

  const pdfWrap = await buildAndStoreEstimatePdf({
    supabase,
    profile,
    userEmail: user.email ?? "",
    estimate: est2,
    customer: {
      full_name: customer?.full_name ?? null,
      email: customer?.email ?? null,
      phone: customer?.phone ?? null,
    },
  });

  const propertyProvince = (est2.property_province as string | null)?.trim() || null;
  const taxRateLabel = invoiceTaxShortLabel(propertyProvince);
  const bizName = profile.business_name?.trim() || "Your contractor";
  const contractorContactEmail = resolveContractorContactEmail(profile, user.email);
  const estimateNumberDisplay =
    String(est2.estimate_number ?? "").trim() || `Estimate ${estimateId.slice(0, 8)}`;
  const issueDateFormatted = formatDateEastern(est2.created_at as string);
  const expRaw = (est2.expiry_date as string | null)?.trim() || null;
  const expiryFormatted = expRaw
    ? formatLocalDateStringEastern(expRaw, { dateStyle: "long" })
    : null;
  const publicUrl = `${resolvePublicAppOrigin()}/estimate/${token}`;

  const sendResult = await sendEstimateEmail({
    toEmail: customerEmail,
    toName: customerName,
    estimateTitle: String(est2.title ?? "Project"),
    estimateNumber: estimateNumberDisplay,
    businessDisplayName: profile.business_name,
    replyToEmail: contractorContactEmail ?? user.email ?? null,
    publicEstimateUrl: publicUrl,
    contractor: {
      businessName: bizName,
      contactName: profile.contractor_name?.trim() || null,
      phone: profile.phone?.trim() || null,
      email: contractorContactEmail,
      addressLines: formatProfileAddressLines(profile),
    },
    issueDate: issueDateFormatted,
    expiryDate: expiryFormatted,
    subtotal: Number(est2.subtotal),
    taxAmount: Number(est2.tax_amount),
    taxRateLabel,
    total: Number(est2.total),
    suggestedDeposit:
      est2.deposit_amount != null && Number(est2.deposit_amount) > 0
        ? Number(est2.deposit_amount)
        : null,
    notes: typeof est2.notes === "string" ? est2.notes.trim() || null : null,
    pdfAttachment: pdfWrap
      ? { filename: pdfWrap.filename, contentBase64: pdfWrap.pdfBase64 }
      : undefined,
    deliveryLog: {
      profileId: profile.id as string,
      type: "estimate",
      relatedEntityId: estimateId,
    },
  });

  revalidatePath(`/estimates/${estimateId}`);
  if (!sendResult.success) {
    return {
      emailSent: false,
      emailError: sendResult.error ?? "Email could not be sent.",
    };
  }
  return { emailSent: true };
}

export async function convertEstimateToJob(
  estimateId: string,
  formData: FormData
): Promise<{ jobId: string } | { error: string } | { fieldErrors: Record<string, string> }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, active_job_limit, province")
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/login");

  const { count } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", profile.id)
    .eq("status", "active");

  if ((count ?? 0) >= profile.active_job_limit) {
    return {
      error: `Active job limit (${profile.active_job_limit}) reached. Complete or cancel a job first.`,
    };
  }

  const { data: est, error: estErr } = await supabase
    .from("estimates")
    .select("*")
    .eq("id", estimateId)
    .eq("profile_id", profile.id)
    .single();

  if (estErr || !est) return { error: "Estimate not found." };
  if (String(est.status) !== "accepted") {
    return { error: "Only accepted estimates can be converted to a job." };
  }
  if (est.job_id) {
    return { error: "This estimate was already converted to a job." };
  }

  const serviceCategory = String(formData.get("service_category") ?? "").trim();
  const tradeErr = validateTrade(serviceCategory);
  if (tradeErr) return { fieldErrors: { service_category: tradeErr } };

  const startDate = String(formData.get("start_date") ?? "").trim();
  const estimatedCompletionDate = String(
    formData.get("estimated_completion_date") ?? ""
  ).trim();
  const scheduleErrs = validateJobEstimatedScheduleDates(startDate, estimatedCompletionDate);
  if (scheduleErrs) return { fieldErrors: scheduleErrs };

  const customerId = String(est.customer_id ?? "");
  if (!customerId) return { error: "Estimate is missing a customer record." };

  const subtotal = Number(est.subtotal);
  const taxRate = Number(est.tax_rate);

  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .insert({
      profile_id: profile.id,
      customer_id: customerId,
      title: String(est.title ?? "Job"),
      description: String(est.scope_of_work ?? "").trim() || null,
      service_category: serviceCategory,
      property_address_line_1: est.property_address_line_1,
      property_address_line_2: est.property_address_line_2,
      property_city: est.property_city,
      property_province: est.property_province,
      property_postal_code: est.property_postal_code,
      deposit_amount: est.deposit_amount,
      tax_rate: taxRate,
      start_date: startDate || null,
      estimated_completion_date: estimatedCompletionDate || null,
      original_contract_price: subtotal,
      current_contract_total: subtotal,
    })
    .select("id")
    .single();

  if (jobErr || !job) return { error: jobErr?.message ?? "Could not create job." };

  const { error: linkErr } = await supabase
    .from("estimates")
    .update({ job_id: job.id as string })
    .eq("id", estimateId)
    .is("job_id", null);

  if (linkErr) {
    await supabase.from("jobs").delete().eq("id", job.id as string);
    return { error: "Could not link estimate to the new job. Please try again." };
  }

  revalidatePath("/estimates");
  revalidatePath(`/estimates/${estimateId}`);
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${job.id as string}`);
  return { jobId: job.id as string };
}

/** Copy an existing estimate into a new draft (same amounts and scope; new number, no send state). */
export async function duplicateEstimateDraft(
  estimateId: string
): Promise<{ newEstimateId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!profile) redirect("/login");

  const { data: row, error } = await supabase
    .from("estimates")
    .select("*")
    .eq("id", estimateId)
    .eq("profile_id", profile.id)
    .single();

  if (error || !row) return { error: "Estimate not found." };

  const { data: ins, error: insErr } = await supabase
    .from("estimates")
    .insert({
      profile_id: row.profile_id as string,
      customer_id: (row.customer_id as string | null) ?? null,
      job_id: null,
      estimate_number: generateEstimateNumber(),
      title: String(row.title ?? "Estimate"),
      scope_of_work: (row.scope_of_work as string | null) ?? null,
      property_address_line_1: (row.property_address_line_1 as string | null) ?? null,
      property_address_line_2: (row.property_address_line_2 as string | null) ?? null,
      property_city: (row.property_city as string | null) ?? null,
      property_province: (row.property_province as string | null) ?? null,
      property_postal_code: (row.property_postal_code as string | null) ?? null,
      subtotal: Number(row.subtotal),
      tax_rate: Number(row.tax_rate),
      tax_amount: Number(row.tax_amount),
      total: Number(row.total),
      deposit_amount: row.deposit_amount != null ? Number(row.deposit_amount) : null,
      expiry_date: (row.expiry_date as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
      status: "draft",
      public_token: null,
      sent_at: null,
      viewed_at: null,
      responded_at: null,
      accepted_at: null,
      declined_at: null,
      estimate_pdf_path: null,
    })
    .select("id")
    .single();

  if (insErr || !ins) return { error: insErr?.message ?? "Could not duplicate estimate." };

  revalidatePath("/estimates");
  revalidatePath("/dashboard");
  return { newEstimateId: ins.id as string };
}
