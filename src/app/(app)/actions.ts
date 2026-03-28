"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { EmailLog, UpdateCategory } from "@/types/database";
import {
  isBusinessProfileCompleteForApp,
  validateBusinessProfileFields,
} from "@/lib/validation/business-profile";
import {
  contractSigningScheduleErrorMessage,
  parsePositiveContractPrice,
  validateCustomerEmail,
  validateCustomerEmailForRemote,
  validateJobEstimatedScheduleDates,
  validateScopeOfWork,
  validateTrade,
} from "@/lib/validation/job-create";
import { resolvePublicAppOrigin } from "@/lib/app-origin";
import { resolveInvoiceTaxRate } from "@/lib/invoice-tax";
import { JOB_LOCKED_SIGNED_CONTRACT_MESSAGE } from "@/lib/job-contract-lock";
import {
  validateChangeOrderDescription,
  validateChangeOrderTitle,
  validateCustomerEmailForChangeOrderRemote,
  parseNewJobTotal,
  validateChangeOrderNewCompletionDate,
} from "@/lib/validation/change-order";
import { sendSigningLinkEmail } from "@/lib/delivery-service";
import { generateUUID } from "@/lib/utils/uuid";

export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error || !data) return null;
  return data;
}

/** Recent transactional email attempts for the signed-in contractor (debugging delivery). */
export async function getRecentEmailLogs(limit = 25): Promise<EmailLog[]> {
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

  const capped = Math.min(Math.max(limit, 1), 100);
  const { data, error } = await supabase
    .from("email_logs")
    .select("id, profile_id, type, recipient_email, status, error_message, related_entity_id, created_at")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(capped);

  if (error) {
    console.error("getRecentEmailLogs:", error.message);
    return [];
  }

  return (data ?? []) as EmailLog[];
}

export async function updateProfileBusinessInfo(formData: FormData) {
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

  const businessName = String(formData.get("business_name") ?? "").trim();
  const contractorName = String(formData.get("contractor_name") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim();
  const addressLine1 = String(formData.get("address_line_1") ?? "").trim();
  const addressLine2 = String(formData.get("address_line_2") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim();
  const province = String(formData.get("province") ?? "").trim();
  const postalCode = String(formData.get("postal_code") ?? "").trim();
  const defaultPaymentTerms =
    String(formData.get("default_contract_payment_terms") ?? "").trim() || null;
  const defaultWarranty =
    String(formData.get("default_contract_warranty_note") ?? "").trim() || null;
  const defaultCancellation =
    String(formData.get("default_contract_cancellation_note") ?? "").trim() || null;
  const defaultTermsAndConditions =
    String(formData.get("default_contract_terms_and_conditions") ?? "").trim() || null;

  const accountEmail = user.email ?? "";

  const fieldErrors = validateBusinessProfileFields({
    business_name: businessName,
    account_email: accountEmail,
    phone,
    address_line_1: addressLine1,
    city,
    province,
    postal_code: postalCode,
  });

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      business_name: businessName,
      contractor_name: contractorName,
      phone,
      address_line_1: addressLine1,
      address_line_2: addressLine2,
      city,
      province,
      postal_code: postalCode,
      default_contract_payment_terms: defaultPaymentTerms,
      default_contract_terms_and_conditions: defaultTermsAndConditions,
      default_contract_warranty_note: defaultWarranty,
      default_contract_cancellation_note: defaultCancellation,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (error) return { error: error.message };

  revalidatePath("/settings/business");
  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  revalidatePath("/onboarding/business-profile");
  return { success: true };
}

export async function getStorageUsage() {
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

  const { data } = await supabase
    .from("storage_usage")
    .select("total_bytes")
    .eq("profile_id", profile.id)
    .single();

  return data?.total_bytes ?? 0;
}

export async function getActiveJobsCount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return 0;

  const { count } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", profile.id)
    .eq("status", "active")
    .eq("contract_status", "signed");

  return count ?? 0;
}

export async function getJobs() {
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

  const { data, error } = await supabase
    .from("jobs")
    .select(
      `
      *,
      customers (
        id,
        full_name,
        email,
        phone,
        address_line_1,
        address_line_2,
        city,
        province,
        postal_code
      )
    `
    )
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) return [];
  return data ?? [];
}

export async function getCustomers() {
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

  const { data, error } = await supabase
    .from("customers")
    .select("id, full_name, email, phone, address_line_1, address_line_2, city, province, postal_code, notes")
    .eq("profile_id", profile.id)
    .order("full_name");

  if (error) return [];
  return data ?? [];
}

export async function createCustomer(formData: FormData) {
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

  const fullName = String(formData.get("full_name") ?? formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const addressLine1 = String(formData.get("address_line_1") ?? "").trim() || null;
  const addressLine2 = String(formData.get("address_line_2") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const province = String(formData.get("province") ?? "").trim() || null;
  const postalCode = String(formData.get("postal_code") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!fullName) {
    return { error: "Customer name is required" };
  }

  const emailErr = validateCustomerEmail(email);
  if (emailErr) {
    return { error: emailErr };
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      profile_id: profile.id,
      full_name: fullName,
      email: email.trim(),
      phone,
      address_line_1: addressLine1,
      address_line_2: addressLine2,
      city,
      province,
      postal_code: postalCode,
      notes,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { customerId: data.id };
}

export async function createJob(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, active_job_limit")
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/login");

  const { count } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", profile.id)
    .eq("status", "active");

  if ((count ?? 0) >= profile.active_job_limit) {
    return { error: `Active job limit (${profile.active_job_limit}) reached. Upgrade your plan for more.` };
  }

  const customerId = String(formData.get("customer_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const scopeOfWork = String(
    formData.get("scope_of_work") ?? formData.get("description") ?? ""
  ).trim();
  const serviceCategory = String(formData.get("service_category") ?? "").trim();
  const propertyAddressLine1 = String(formData.get("property_address_line_1") ?? "").trim() || null;
  const propertyAddressLine2 = String(formData.get("property_address_line_2") ?? "").trim() || null;
  const propertyCity = String(formData.get("property_city") ?? "").trim() || null;
  const propertyProvince = String(formData.get("property_province") ?? "").trim() || null;
  const propertyPostalCode = String(formData.get("property_postal_code") ?? "").trim() || null;
  const depositAmountRaw = formData.get("deposit_amount");
  const depositAmount = depositAmountRaw ? parseFloat(String(depositAmountRaw)) : null;
  const taxRateRaw = formData.get("tax_rate");
  const taxRate = taxRateRaw ? parseFloat(String(taxRateRaw)) : 0;
  const startDate = String(formData.get("start_date") ?? "").trim();
  const estimatedCompletionDate = String(formData.get("estimated_completion_date") ?? "").trim();
  const originalContractPriceRaw = formData.get("original_contract_price");

  if (!customerId || !title) {
    return { error: "Customer and job title are required" };
  }

  const tradeErr = validateTrade(serviceCategory);
  if (tradeErr) {
    return { fieldErrors: { service_category: tradeErr } };
  }

  const { data: customerRow } = await supabase
    .from("customers")
    .select("email")
    .eq("id", customerId)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!customerRow) {
    return { error: "Customer not found" };
  }
  const custEmailErr = validateCustomerEmail(customerRow.email);
  if (custEmailErr) {
    return { fieldErrors: { customer_email: custEmailErr } };
  }

  const scopeErr = validateScopeOfWork(scopeOfWork);
  if (scopeErr) {
    return { fieldErrors: { scope_of_work: scopeErr } };
  }

  if (!propertyAddressLine1) {
    return { error: "Property address line 1 is required" };
  }
  if (!propertyCity) {
    return { error: "Property city is required" };
  }
  if (!propertyProvince) {
    return { error: "Property province is required" };
  }

  const scheduleErrs = validateJobEstimatedScheduleDates(startDate, estimatedCompletionDate);
  if (scheduleErrs) {
    return { fieldErrors: scheduleErrs };
  }

  const priceResult = parsePositiveContractPrice(originalContractPriceRaw);
  if (!priceResult.ok) {
    return { fieldErrors: { original_contract_price: priceResult.message } };
  }
  const originalContractPrice = priceResult.value;

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      profile_id: profile.id,
      customer_id: customerId,
      title,
      description: scopeOfWork,
      service_category: serviceCategory,
      property_address_line_1: propertyAddressLine1,
      property_address_line_2: propertyAddressLine2,
      property_city: propertyCity,
      property_province: propertyProvince,
      property_postal_code: propertyPostalCode,
      deposit_amount: depositAmount,
      tax_rate: taxRate,
      start_date: startDate,
      estimated_completion_date: estimatedCompletionDate,
      original_contract_price: originalContractPrice,
      current_contract_total: originalContractPrice,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/jobs/create");
  return { jobId: data.id };
}

export async function updateJob(jobId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: job } = await supabase
    .from("jobs")
    .select("id, profile_id, customer_id")
    .eq("id", jobId)
    .single();

  if (!job) return { error: "Job not found" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile || job.profile_id !== profile.id) {
    return { error: "Unauthorized" };
  }

  const { data: signedContract } = await supabase
    .from("contracts")
    .select("id")
    .eq("job_id", jobId)
    .eq("status", "signed")
    .limit(1)
    .maybeSingle();

  if (signedContract) {
    return { error: JOB_LOCKED_SIGNED_CONTRACT_MESSAGE };
  }

  const { data: jobWithTotal } = await supabase
    .from("jobs")
    .select("approved_change_total")
    .eq("id", jobId)
    .single();

  const title = String(formData.get("title") ?? "").trim();
  const scopeOfWork = String(
    formData.get("scope_of_work") ?? formData.get("description") ?? ""
  ).trim();
  const serviceCategory = String(formData.get("service_category") ?? "").trim();
  const propertyAddressLine1 = String(formData.get("property_address_line_1") ?? "").trim() || null;
  const propertyAddressLine2 = String(formData.get("property_address_line_2") ?? "").trim() || null;
  const propertyCity = String(formData.get("property_city") ?? "").trim() || null;
  const propertyProvince = String(formData.get("property_province") ?? "").trim() || null;
  const propertyPostalCode = String(formData.get("property_postal_code") ?? "").trim() || null;
  const depositAmountRaw = formData.get("deposit_amount");
  const depositAmount = depositAmountRaw ? parseFloat(String(depositAmountRaw)) : null;
  const taxRateRaw = formData.get("tax_rate");
  const taxRate = taxRateRaw ? parseFloat(String(taxRateRaw)) : 0;
  const startDate = String(formData.get("start_date") ?? "").trim();
  const estimatedCompletionDate = String(formData.get("estimated_completion_date") ?? "").trim();
  const originalContractPriceRaw = formData.get("original_contract_price");

  if (!title) return { error: "Job title is required" };

  const tradeErr = validateTrade(serviceCategory);
  if (tradeErr) {
    return { fieldErrors: { service_category: tradeErr } };
  }

  const customerEmailInput = String(formData.get("customer_email") ?? "").trim();
  const customerEmailFieldErr = validateCustomerEmail(customerEmailInput);
  if (customerEmailFieldErr) {
    return { fieldErrors: { customer_email: customerEmailFieldErr } };
  }

  const { data: linkedCustomer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", job.customer_id)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!linkedCustomer) {
    return { error: "Customer not found for this job" };
  }

  const scopeErr = validateScopeOfWork(scopeOfWork);
  if (scopeErr) {
    return { fieldErrors: { scope_of_work: scopeErr } };
  }

  if (!propertyAddressLine1) return { error: "Property address line 1 is required" };
  if (!propertyCity) return { error: "Property city is required" };
  if (!propertyProvince) return { error: "Property province is required" };

  const scheduleErrs = validateJobEstimatedScheduleDates(startDate, estimatedCompletionDate);
  if (scheduleErrs) {
    return { fieldErrors: scheduleErrs };
  }

  const priceResult = parsePositiveContractPrice(originalContractPriceRaw);
  if (!priceResult.ok) {
    return { fieldErrors: { original_contract_price: priceResult.message } };
  }
  const originalContractPrice = priceResult.value;

  const approvedChange = Number(jobWithTotal?.approved_change_total ?? 0);
  const newContractTotal = originalContractPrice + approvedChange;

  const { error: customerEmailUpdateError } = await supabase
    .from("customers")
    .update({ email: customerEmailInput })
    .eq("id", job.customer_id)
    .eq("profile_id", profile.id);

  if (customerEmailUpdateError) {
    return { error: customerEmailUpdateError.message };
  }

  const { error } = await supabase
    .from("jobs")
    .update({
      title,
      description: scopeOfWork,
      service_category: serviceCategory,
      property_address_line_1: propertyAddressLine1,
      property_address_line_2: propertyAddressLine2,
      property_city: propertyCity,
      property_province: propertyProvince,
      property_postal_code: propertyPostalCode,
      deposit_amount: depositAmount,
      tax_rate: taxRate,
      start_date: startDate,
      estimated_completion_date: estimatedCompletionDate,
      original_contract_price: originalContractPrice,
      current_contract_total: newContractTotal,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/jobs/create");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}/edit`);
  revalidatePath(`/jobs/${jobId}/contract`);
  return { success: true };
}

export async function markJobComplete(jobId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: job } = await supabase
    .from("jobs")
    .select("id, profile_id, status")
    .eq("id", jobId)
    .single();

  if (!job) return { error: "Job not found" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile || job.profile_id !== profile.id) {
    return { error: "Unauthorized" };
  }

  if (job.status === "completed") {
    return { success: true as const };
  }
  if (job.status === "cancelled") {
    return { error: "Cancelled jobs cannot be marked complete." };
  }

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from("jobs")
    .update({
      status: "completed",
      actual_completion_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}/invoices`);
  return { success: true as const };
}

export async function getJob(jobId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("jobs")
    .select(
      `
      *,
      customers (
        id,
        full_name,
        email,
        phone,
        address_line_1,
        address_line_2,
        city,
        province,
        postal_code
      )
    `
    )
    .eq("id", jobId)
    .single();

  if (error || !data) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile || data.profile_id !== profile.id) return null;

  return data;
}

export async function getJobUpdates(jobId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: job } = await supabase
    .from("jobs")
    .select("id, profile_id")
    .eq("id", jobId)
    .single();

  if (!job) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile || job.profile_id !== profile.id) return [];

  const { data } = await supabase
    .from("job_updates")
    .select(
      `
      *,
      job_update_attachments (*)
    `
    )
    .eq("job_id", jobId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  return data ?? [];
}

function attachmentIsLikelyImage(a: {
  file_type: string | null;
  mime_type: string | null;
  file_name: string;
}): boolean {
  if (a.file_type === "photo") return true;
  if (a.mime_type?.toLowerCase().startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(a.file_name);
}

/** Same rows as getJobUpdates, with signedUrl on each attachment when it is an image (for thumbnails / lightbox). */
export async function getJobUpdatesWithSignedAttachmentUrls(jobId: string) {
  const updates = await getJobUpdates(jobId);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const pathsToSign = new Set<string>();
  for (const u of updates) {
    for (const a of u.job_update_attachments ?? []) {
      if (attachmentIsLikelyImage(a) && a.storage_path) {
        pathsToSign.add(a.storage_path);
      }
    }
  }

  const urlByPath = new Map<string, string>();
  await Promise.all(
    [...pathsToSign].map(async (path) => {
      const { data } = await supabase.storage
        .from("job-attachments")
        .createSignedUrl(path, 3600);
      if (data?.signedUrl) urlByPath.set(path, data.signedUrl);
    })
  );

  return updates.map((u) => ({
    ...u,
    job_update_attachments: (u.job_update_attachments ?? []).map(
      (a: Record<string, unknown>) => ({
        ...a,
        signedUrl: urlByPath.get(String(a.storage_path)) ?? null,
      })
    ),
  }));
}

export type CreateJobUpdateResult = { success: true } | { error: string };

export async function createJobUpdate(
  jobId: string,
  formData: FormData,
  filePaths: {
    storagePath: string;
    fileName: string;
    sizeBytes: number;
    mimeType?: string;
    fileType?: string;
  }[]
): Promise<CreateJobUpdateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[createJobUpdate] no session — redirecting to login (client may show false success if redirect is mishandled)"
      );
    }
    redirect("/login");
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("id, profile_id")
    .eq("id", jobId)
    .single();

  if (!job) return { error: "Job not found" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile || job.profile_id !== profile.id) {
    return { error: "Unauthorized" };
  }

  const category = (formData.get("category") as UpdateCategory) ?? "other";
  const title = String(formData.get("title") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const dateStr = formData.get("date");
  const date = dateStr ? String(dateStr) : new Date().toISOString().slice(0, 10);

  if (!title) {
    return { error: "Title is required" };
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[createJobUpdate] input", {
      jobId,
      titlePreview: title.slice(0, 120),
      notePresent: Boolean(note),
      date,
      category,
      filePathsCount: filePaths.length,
      filePathsDetail: filePaths.map((f) => ({
        storagePath: f.storagePath,
        fileName: f.fileName,
        mimeType: f.mimeType,
        fileType: f.fileType,
        sizeBytes: f.sizeBytes,
      })),
      location_attach_camera_session: String(
        formData.get("location_attach_camera_session") ?? ""
      ),
    });
  }

  const locSource = String(formData.get("location_source") ?? "").trim();
  const locLatRaw = formData.get("location_latitude");
  const locLngRaw = formData.get("location_longitude");
  const locAccRaw = formData.get("location_accuracy_meters");
  const locAtRaw = formData.get("location_captured_at");

  type LocationInsert = {
    location_latitude: number;
    location_longitude: number;
    location_accuracy_meters: number | null;
    location_captured_at: string;
    location_source: "device_current";
  };

  let locationInsert: LocationInsert | null = null;
  if (locSource === "device_current" && locLatRaw != null && locLngRaw != null && locAtRaw) {
    const lat = Number(locLatRaw);
    const lng = Number(locLngRaw);
    const accStr = locAccRaw != null && String(locAccRaw).trim() !== "" ? Number(locAccRaw) : NaN;
    const capturedAt = String(locAtRaw).trim();
    const acc =
      Number.isFinite(accStr) && accStr >= 0 ? accStr : null;
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180 &&
      capturedAt.length > 0
    ) {
      locationInsert = {
        location_latitude: lat,
        location_longitude: lng,
        location_accuracy_meters: acc,
        location_captured_at: capturedAt,
        location_source: "device_current",
      };
    }
  }

  const attachSession =
    String(formData.get("location_attach_camera_session") ?? "").trim() === "true";
  const hasPhotoAttachment = filePaths.some((f) => f.fileType === "photo");
  if (!attachSession || !hasPhotoAttachment) {
    locationInsert = null;
  }

  const { data: update, error } = await supabase
    .from("job_updates")
    .insert({
      job_id: jobId,
      category,
      title,
      note,
      date,
      ...(locationInsert ?? {}),
    })
    .select("id")
    .single();

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[createJobUpdate] job_updates insert FAILED", error.message);
    }
    return { error: error.message };
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[createJobUpdate] job_updates insert OK", { updateId: update?.id });
  }

  if (filePaths.length > 0) {
    const documentedAt = new Date().toISOString();
    const attachments = filePaths.map((f, i) => ({
      job_update_id: update.id,
      job_id: jobId,
      storage_path: f.storagePath,
      file_name: f.fileName,
      file_size_bytes: f.sizeBytes,
      original_file_name: f.fileName,
      mime_type: f.mimeType ?? null,
      file_type: f.fileType ?? null,
      sort_order: i,
      uploaded_by_user_id: user.id,
      captured_at: documentedAt,
    }));

    const { error: attachError } = await supabase
      .from("job_update_attachments")
      .insert(attachments);

    if (attachError) {
      console.error("Failed to save attachment records:", attachError);
      if (process.env.NODE_ENV === "development") {
        console.error("[createJobUpdate] job_update_attachments insert FAILED", {
          message: attachError.message,
          code: attachError.code,
          details: attachError.details,
          hint: attachError.hint,
          rowCount: attachments.length,
        });
      }
      await supabase.from("job_updates").delete().eq("id", update.id);
      if (process.env.NODE_ENV === "development") {
        console.warn("[createJobUpdate] rolled back job_updates row", {
          deletedUpdateId: update.id,
        });
      }
      return {
        error: `Could not save file attachments: ${attachError.message}. The update was not saved.`,
      };
    }

    if (process.env.NODE_ENV === "development") {
      console.log("[createJobUpdate] job_update_attachments insert OK", {
        rows: attachments.length,
      });
    }

    const totalBytes = filePaths.reduce((s, f) => s + f.sizeBytes, 0);
    const { data: usage } = await supabase
      .from("storage_usage")
      .select("total_bytes")
      .eq("profile_id", profile.id)
      .single();

    if (usage) {
      await supabase
        .from("storage_usage")
        .update({
          total_bytes: (usage.total_bytes ?? 0) + totalBytes,
          updated_at: new Date().toISOString(),
        })
        .eq("profile_id", profile.id);
    }
  }

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}/updates/new`);
  return { success: true };
}

// =============================================================================
// Contract actions (Phase 2)
// =============================================================================

export async function getContractForJob(jobId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: job } = await supabase
    .from("jobs")
    .select("id, profile_id")
    .eq("id", jobId)
    .single();

  if (!job) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile || job.profile_id !== profile.id) return null;

  const { data } = await supabase
    .from("contracts")
    .select("*")
    .eq("job_id", jobId)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();

  return data;
}

/** How the save should affect contract workflow status (see docs in repo / team wiki). */
export type ContractSaveIntent =
  /** New or draft only; rejected if contract is already pending (awaiting signature). */
  | "save_draft"
  /** Validate + set status to pending (new insert, draft→pending, or refresh pending content). */
  | "submit_for_signing"
  /**
   * Same validation as submit_for_signing, but keeps draft until remote email succeeds.
   * If already pending (resend), stays pending while updating content.
   */
  | "save_for_remote_delivery"
  /** Update stored fields while keeping status pending; no signing validation. */
  | "save_pending_edits"
  /** Explicit pending→draft; use when withdrawing from customer signing. */
  | "withdraw_to_draft";

export async function createOrUpdateContract(
  jobId: string,
  contractData: Record<string, unknown>,
  intent: ContractSaveIntent,
  structured?: {
    contractorName?: string;
    companyName?: string;
    contractorEmail?: string;
    contractorPhone?: string;
    contractorAddress?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    jobTitle?: string;
    jobAddress?: string;
    scopeOfWork?: string;
    price?: number;
    depositAmount?: number;
    paymentTerms?: string;
    taxIncluded?: boolean;
    taxRate?: number;
    warrantyNote?: string;
    cancellationChangeNote?: string;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: job } = await supabase
    .from("jobs")
    .select("id, profile_id")
    .eq("id", jobId)
    .single();

  if (!job) return { error: "Job not found" };

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, business_name, phone, address_line_1, city, province, postal_code"
    )
    .eq("user_id", user.id)
    .single();

  if (!profile || job.profile_id !== profile.id) {
    return { error: "Unauthorized" };
  }

  const { data: existingEditable } = await supabase
    .from("contracts")
    .select("id, version_number, status")
    .eq("job_id", jobId)
    .in("status", ["draft", "pending"])
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const existing = existingEditable;

  if (!existing) {
    const { data: signedBlock } = await supabase
      .from("contracts")
      .select("id")
      .eq("job_id", jobId)
      .eq("status", "signed")
      .limit(1)
      .maybeSingle();
    if (signedBlock) {
      return { error: "This job already has a signed contract." };
    }
  }

  if (intent === "save_pending_edits" || intent === "withdraw_to_draft") {
    if (!existing) {
      return { error: "No draft or pending contract found to update." };
    }
  }

  if (intent === "save_draft") {
    if (existing?.status === "pending") {
      return {
        error:
          "This contract is awaiting customer signature. Use “Save changes (awaiting signature)” to update the wording without changing status, or “Move back to draft” if you need to withdraw it from signing.",
      };
    }
  }

  if (intent === "save_pending_edits" && existing?.status !== "pending") {
    return {
      error:
        "“Save changes (awaiting signature)” only applies when the contract is awaiting signature.",
    };
  }

  if (intent === "withdraw_to_draft") {
    if (existing?.status !== "pending") {
      return {
        error: "Only a contract that is awaiting signature can be moved back to draft.",
      };
    }
  }

  if (intent === "submit_for_signing" || intent === "save_for_remote_delivery") {
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
          "Please complete your business profile before proceeding. Go to Settings → Business.",
      };
    }
    const scopeOfWork = structured?.scopeOfWork ?? (contractData.scope as string) ?? "";
    const price = structured?.price ?? (contractData.price as number);
    const customerName = structured?.customerName ?? "";
    const paymentTerms = structured?.paymentTerms ?? (contractData.paymentTerms as string) ?? "";
    if (!scopeOfWork?.trim()) return { error: "Scope of work is required before signing." };
    if (price == null || price <= 0) return { error: "Contract price is required before signing." };
    if (!customerName?.trim()) return { error: "Customer name is required before signing." };
    if (!paymentTerms?.trim()) return { error: "Payment terms are required before signing." };
    const cdDates = contractData as Record<string, unknown>;
    const schedErr = contractSigningScheduleErrorMessage(
      String(cdDates.startDate ?? "").trim(),
      String(cdDates.completionDate ?? "").trim()
    );
    if (schedErr) return { error: schedErr };
  }

  let nextStatus: "draft" | "pending";
  if (intent === "save_draft" || intent === "withdraw_to_draft") {
    nextStatus = "draft";
  } else if (intent === "save_for_remote_delivery") {
    nextStatus = existing?.status === "pending" ? "pending" : "draft";
  } else {
    nextStatus = "pending";
  }

  const payload = {
    contract_data: contractData,
    status: nextStatus,
    contractor_name: structured?.contractorName ?? null,
    company_name: structured?.companyName ?? null,
    contractor_email: structured?.contractorEmail ?? null,
    contractor_phone: structured?.contractorPhone ?? null,
    contractor_address: structured?.contractorAddress ?? null,
    customer_name: structured?.customerName ?? null,
    customer_email: structured?.customerEmail ?? null,
    customer_phone: structured?.customerPhone ?? null,
    job_title: structured?.jobTitle ?? null,
    job_address: structured?.jobAddress ?? null,
    scope_of_work: structured?.scopeOfWork ?? (contractData.scope as string) ?? null,
    price: structured?.price ?? (contractData.price as number) ?? null,
    deposit_amount: structured?.depositAmount ?? (contractData.deposit as number) ?? null,
    payment_terms: structured?.paymentTerms ?? (contractData.paymentTerms as string) ?? null,
    tax_included: structured?.taxIncluded ?? false,
    tax_rate: structured?.taxRate ?? 0,
    warranty_note: structured?.warrantyNote ?? null,
    cancellation_change_note: structured?.cancellationChangeNote ?? null,
  };

  if (existing) {
    const { data, error } = await supabase
      .from("contracts")
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .single();

    if (error) return { error: error.message };

    await supabase
      .from("jobs")
      .update({ contract_status: nextStatus })
      .eq("id", jobId);

    revalidatePath(`/jobs/${jobId}`);
    revalidatePath(`/jobs/${jobId}/contract`);
    return { contractId: data.id };
  }

  if (intent === "save_pending_edits" || intent === "withdraw_to_draft") {
    return { error: "No draft or pending contract found to update." };
  }

  const { data, error } = await supabase
    .from("contracts")
    .insert({
      job_id: jobId,
      profile_id: profile.id,
      ...payload,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase.from("jobs").update({ contract_status: nextStatus }).eq("id", jobId);

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}/contract`);
  return { contractId: data.id };
}

export async function sendContractForSigning(contractId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, job_id, profile_id, status, contract_data")
    .eq("id", contractId)
    .single();

  if (!contract) return { error: "Contract not found" };
  if (contract.status === "signed") {
    return { error: "Cannot modify a signed contract." };
  }

  const cdSend = (contract.contract_data as Record<string, unknown>) ?? {};
  const sendSchedErr = contractSigningScheduleErrorMessage(
    String(cdSend.startDate ?? "").trim(),
    String(cdSend.completionDate ?? "").trim()
  );
  if (sendSchedErr) {
    return { error: `${sendSchedErr} Add both dates on the contract before sending for signature.` };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, business_name, phone, address_line_1, city, province, postal_code"
    )
    .eq("user_id", user.id)
    .single();

  if (!profile || contract.profile_id !== profile.id) {
    return { error: "Unauthorized" };
  }
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
        "Please complete your business profile before proceeding. Go to Settings → Business.",
    };
  }

  const { error } = await supabase
    .from("contracts")
    .update({ status: "pending" })
    .eq("id", contractId);

  if (error) return { error: error.message };

  await supabase
    .from("jobs")
    .update({ contract_status: "pending" })
    .eq("id", contract.job_id);

  revalidatePath(`/jobs/${contract.job_id}`);
  revalidatePath(`/jobs/${contract.job_id}/contract`);
  return { success: true };
}

/** Best-effort client IP for signing audit (first hop in X-Forwarded-For chain). */
function clientIpFromRequestHeaders(h: Headers): string | null {
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = h.get("x-real-ip")?.trim();
  return real || null;
}

export async function signContractDevice(
  contractId: string,
  params: {
    signerName: string;
    signerEmail: string;
    signerPhone?: string;
    consentCheckbox: boolean;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: preContract } = await supabase
    .from("contracts")
    .select("contract_data")
    .eq("id", contractId)
    .single();
  const preCd = (preContract?.contract_data as Record<string, unknown>) ?? {};
  const deviceSchedErr = contractSigningScheduleErrorMessage(
    String(preCd.startDate ?? "").trim(),
    String(preCd.completionDate ?? "").trim()
  );
  if (deviceSchedErr) {
    return { error: deviceSchedErr };
  }

  const headersList = await headers();
  const ip = clientIpFromRequestHeaders(headersList);
  const userAgent = headersList.get("user-agent")?.trim() || null;

  const { data, error } = await supabase.rpc("sign_contract_device", {
    p_contract_id: contractId,
    p_signer_name: params.signerName,
    p_signer_email: params.signerEmail,
    p_signer_phone: params.signerPhone ?? null,
    p_consent_checkbox: params.consentCheckbox,
    p_signed_ip_address: ip,
    p_signed_user_agent: userAgent,
  });

  if (error) return { error: error.message };
  const result = data as { success: boolean; error?: string } | null;
  if (!result?.success) return { error: result?.error ?? "Signing failed" };

  await deliverSignedContract(contractId);

  const { data: contract } = await supabase
    .from("contracts")
    .select("job_id")
    .eq("id", contractId)
    .single();

  if (contract) {
    revalidatePath(`/jobs/${contract.job_id}`);
    revalidatePath(`/jobs/${contract.job_id}/contract`);
  }
  return { success: true };
}

function formatContractDateForEmail(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    try {
      return new Date(`${s}T12:00:00`).toLocaleDateString(undefined, {
        dateStyle: "medium",
      });
    } catch {
      return s;
    }
  }
  return s;
}

function buildSignedContractSummaryRows(contract: {
  job_title: string | null;
  job_address: string | null;
  scope_of_work: string | null;
  price: number | null;
  contract_data: unknown;
  deposit_amount: number | null;
  payment_terms: string | null;
}): { label: string; value: string }[] {
  const cd = (contract.contract_data as Record<string, unknown>) ?? {};
  const scopeRaw = String(contract.scope_of_work ?? cd.scope ?? "").trim();
  const scopeDisplay =
    scopeRaw.length > 450 ? `${scopeRaw.slice(0, 447)}…` : scopeRaw || "—";
  const price = contract.price;
  const priceStr =
    price != null && Number.isFinite(Number(price))
      ? `$${Number(price).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : "—";
  const dep = contract.deposit_amount;
  return [
    { label: "Contract / job", value: contract.job_title?.trim() || "—" },
    { label: "Property / job address", value: contract.job_address?.trim() || "—" },
    { label: "Estimated start", value: formatContractDateForEmail(cd.startDate) },
    {
      label: "Estimated completion",
      value: formatContractDateForEmail(cd.completionDate),
    },
    { label: "Contract price", value: priceStr },
    {
      label: "Deposit",
      value:
        dep != null && Number(dep) > 0
          ? `$${Number(dep).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          : "—",
    },
    { label: "Scope of work", value: scopeDisplay },
    {
      label: "Payment terms",
      value: String(contract.payment_terms ?? "—").slice(0, 800),
    },
  ];
}

async function deliverSignedContract(contractId: string) {
  const supabase = await createClient();
  const { data: contract } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .single();

  if (!contract) return;

  const { generateSignedContractPdf, contractDbRowToPdfInput } = await import(
    "@/lib/contract-pdf"
  );
  const { sendSignedContractEmail } = await import("@/lib/delivery-service");
  const { createServiceRoleClient } = await import("@/lib/supabase/service-role");

  const pdfPath = await generateSignedContractPdf(contractDbRowToPdfInput(contract));

  let effectivePdfPath = contract.pdf_path ?? null;
  if (pdfPath) {
    await supabase.from("contracts").update({ pdf_path: pdfPath }).eq("id", contractId);
    effectivePdfPath = pdfPath;
  }

  let pdfAttachment: { filename: string; contentBase64: string } | undefined;
  if (effectivePdfPath) {
    const admin = createServiceRoleClient();
    if (admin) {
      const { data: blob, error: dlErr } = await admin.storage
        .from("contract-pdfs")
        .download(effectivePdfPath);
      if (!dlErr && blob) {
        const buf = Buffer.from(await blob.arrayBuffer());
        pdfAttachment = {
          filename: `signed-contract-${contractId.slice(0, 8)}.pdf`,
          contentBase64: buf.toString("base64"),
        };
      } else if (dlErr) {
        console.warn(
          "[deliverSignedContract] Could not download PDF for email attachment:",
          dlErr.message
        );
      }
    }
  }

  const summaryRows = buildSignedContractSummaryRows(contract);
  const customerEmail = (
    contract.signer_email ||
    contract.customer_email ||
    ""
  ).trim();
  const customerName = (
    contract.signer_name ||
    contract.customer_name ||
    "Customer"
  ).trim();
  const contractorEmail = String(contract.contractor_email ?? "").trim();
  const norm = (e: string) => e.toLowerCase();
  const sameRecipient =
    customerEmail &&
    contractorEmail &&
    norm(customerEmail) === norm(contractorEmail);

  const dashboardLink = `${resolvePublicAppOrigin()}/jobs/${contract.job_id}/contract`;
  const bizName = contract.company_name ?? null;
  const logBase = {
    profileId: contract.profile_id as string,
    type: "contract" as const,
    relatedEntityId: contractId,
  };

  if (customerEmail) {
    await sendSignedContractEmail({
      toEmail: customerEmail,
      toName: customerName,
      jobTitle: contract.job_title ?? "Contract",
      businessDisplayName: bizName,
      recipient: "customer",
      summaryRows,
      pdfAttachment,
      contractorDashboardLink: sameRecipient ? dashboardLink : null,
      alsoContractorOnAccount: Boolean(sameRecipient),
      deliveryLog: logBase,
    });
  }

  if (contractorEmail && !sameRecipient) {
    await sendSignedContractEmail({
      toEmail: contractorEmail,
      toName: contract.contractor_name?.trim() || "Contractor",
      jobTitle: contract.job_title ?? "Contract",
      businessDisplayName: bizName,
      recipient: "contractor",
      summaryRows,
      pdfAttachment,
      contractorDashboardLink: dashboardLink,
      deliveryLog: logBase,
    });
  }
}

export type RemoteSigningFailureReason =
  | "invalid"
  | "cancelled"
  | "expired"
  | "already_used"
  | "withdrawn";

export type RemoteSigningBundleResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; reason: RemoteSigningFailureReason };

/** Public signing page: full contract payload or a specific failure reason (for messaging). */
export async function getRemoteSigningBundle(
  token: string
): Promise<RemoteSigningBundleResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_remote_signing_bundle", {
    p_token: token,
  });

  if (error || data == null) {
    return { ok: false, reason: "invalid" };
  }

  const row = data as { ok?: boolean; reason?: string; [key: string]: unknown };
  if (row.ok === true) {
    const { ok: _ok, reason: _reason, ...rest } = row;
    return { ok: true, data: rest as Record<string, unknown> };
  }

  const reason = row.reason as RemoteSigningFailureReason | undefined;
  if (
    reason === "cancelled" ||
    reason === "expired" ||
    reason === "already_used" ||
    reason === "withdrawn"
  ) {
    return { ok: false, reason };
  }
  return { ok: false, reason: "invalid" };
}

/** @deprecated Prefer getRemoteSigningBundle when you need failure reasons; this returns null for any failure. */
export async function getContractBySigningToken(token: string) {
  const bundle = await getRemoteSigningBundle(token);
  if (bundle.ok) return bundle.data;
  return null;
}

export async function signContractRemote(
  token: string,
  params: {
    signerName: string;
    signerEmail: string;
    signerPhone?: string;
    consentCheckbox: boolean;
  }
) {
  const bundle = await getRemoteSigningBundle(token);
  if (!bundle.ok) {
    const msg: Record<RemoteSigningFailureReason, string> = {
      invalid: "Invalid signing link.",
      cancelled: "This signing link was cancelled.",
      expired: "This signing link has expired.",
      already_used: "This link was already used.",
      withdrawn: "This contract is no longer awaiting signature.",
    };
    return { error: msg[bundle.reason] };
  }
  const remoteCd = (bundle.data.contract_data as Record<string, unknown>) ?? {};
  const remoteSchedErr = contractSigningScheduleErrorMessage(
    String(remoteCd.startDate ?? "").trim(),
    String(remoteCd.completionDate ?? "").trim()
  );
  if (remoteSchedErr) {
    return {
      error: `${remoteSchedErr} Your contractor must update the contract and send a new signing link.`,
    };
  }

  const supabase = await createClient();
  const headersList = await headers();
  const ip = clientIpFromRequestHeaders(headersList);
  const userAgent = headersList.get("user-agent")?.trim() || null;

  const { data, error } = await supabase.rpc("sign_contract_remote", {
    p_token: token,
    p_signer_name: params.signerName.trim(),
    p_signer_email: params.signerEmail.trim(),
    p_signer_phone: params.signerPhone?.trim() ?? null,
    p_consent_checkbox: params.consentCheckbox,
    p_signed_ip_address: ip,
    p_signed_user_agent: userAgent,
  });

  if (error) return { error: error.message };
  const result = data as { success: boolean; error?: string; contract_id?: string } | null;
  if (!result?.success) return { error: result?.error ?? "Signing failed" };
  if (result.contract_id) {
    await deliverSignedContract(result.contract_id);
  }
  return { success: true };
}

/** After a failed remote signing email: remove the new token; revert pending→draft only if this was a first send (not a resend). */
async function cleanupAfterFailedContractSigningEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    contractId: string;
    jobId: string;
    token: string | null;
    /** True if contract was already pending before this send attempt (resend flow). */
    wasAlreadyAwaitingSignature: boolean;
  }
) {
  if (params.token) {
    await supabase.from("contract_signing_tokens").delete().eq("token", params.token);
  }
  if (!params.wasAlreadyAwaitingSignature) {
    await supabase
      .from("contracts")
      .update({ status: "draft", updated_at: new Date().toISOString() })
      .eq("id", params.contractId);
    await supabase.from("jobs").update({ contract_status: "draft" }).eq("id", params.jobId);
  }
}

export async function createSigningToken(contractId: string, expiresInDays = 7) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, profile_id")
    .eq("id", contractId)
    .single();

  if (!contract) return { error: "Contract not found" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile || contract.profile_id !== profile.id) {
    return { error: "Unauthorized" };
  }

  const token = generateUUID() + generateUUID().replace(/-/g, "");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const { data, error } = await supabase
    .from("contract_signing_tokens")
    .insert({
      contract_id: contractId,
      token,
      expires_at: expiresAt.toISOString(),
      status: "active",
    })
    .select("token, expires_at")
    .single();

  if (error) return { error: error.message };
  return { token: data.token, expiresAt: data.expires_at };
}

/**
 * Remote signing: move draft→pending (or keep pending on resend), create token, send email.
 * On any failure after status/token changes, rolls back so the contract is not left “half sent”.
 * Call `createOrUpdateContract` with `save_for_remote_delivery` first so content is saved without pending (first send).
 */
export async function sendRemoteContractSigningLink(params: {
  jobId: string;
  contractId: string;
  toEmail: string;
  customerName: string;
  jobTitle: string;
  /** From the browser, e.g. `window.location.origin`, so the email contains a working absolute URL */
  publicOrigin?: string;
}): Promise<{ success?: true; error?: string }> {
  const remoteEmailErr = validateCustomerEmailForRemote(params.toEmail);
  if (remoteEmailErr) {
    return { error: remoteEmailErr };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: job } = await supabase
    .from("jobs")
    .select("id, profile_id")
    .eq("id", params.jobId)
    .single();

  if (!job) return { error: "Job not found" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, business_name")
    .eq("user_id", user.id)
    .single();

  if (!profile || job.profile_id !== profile.id) {
    return { error: "Unauthorized" };
  }

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, job_id, profile_id, status")
    .eq("id", params.contractId)
    .single();

  if (!contract || contract.job_id !== params.jobId || contract.profile_id !== profile.id) {
    return { error: "Contract not found" };
  }

  if (contract.status === "signed") {
    return { error: "Cannot send a signed contract for remote signing." };
  }

  const wasAlreadyAwaitingSignature = contract.status === "pending";

  const sendResult = await sendContractForSigning(params.contractId);
  if (sendResult?.error) {
    return { error: sendResult.error };
  }

  const tokenResult = await createSigningToken(params.contractId, 7);
  if (tokenResult?.error || !tokenResult?.token) {
    await cleanupAfterFailedContractSigningEmail(supabase, {
      contractId: params.contractId,
      jobId: params.jobId,
      token: null,
      wasAlreadyAwaitingSignature,
    });
    revalidatePath(`/jobs/${params.jobId}`);
    revalidatePath(`/jobs/${params.jobId}/contract`);
    return {
      error:
        tokenResult?.error ??
        "Failed to create signing link. The contract was not sent for signature.",
    };
  }

  const baseUrl = resolvePublicAppOrigin(params.publicOrigin);
  const signingUrl = `${baseUrl}/sign/${tokenResult.token}`;

  const emailResult = await sendSigningLinkEmail({
    toEmail: params.toEmail.trim(),
    toName: params.customerName.trim() || "Customer",
    signingUrl,
    jobTitle: params.jobTitle.trim(),
    expiresAt: new Date(tokenResult.expiresAt),
    businessDisplayName: profile.business_name ?? null,
    deliveryLog: {
      profileId: profile.id,
      type: "contract",
      relatedEntityId: params.contractId,
    },
  });

  if (!emailResult.success) {
    await cleanupAfterFailedContractSigningEmail(supabase, {
      contractId: params.contractId,
      jobId: params.jobId,
      token: tokenResult.token,
      wasAlreadyAwaitingSignature,
    });
    revalidatePath(`/jobs/${params.jobId}`);
    revalidatePath(`/jobs/${params.jobId}/contract`);
    const detail = emailResult.error ?? "Failed to send signing email.";
    if (wasAlreadyAwaitingSignature) {
      return {
        error: `${detail} The contract is still awaiting signature. No new link was created—try again, or use “Move back to draft” if you need to change the contract.`,
      };
    }
    return {
      error: `${detail} The contract was not sent for signature and has been returned to draft.`,
    };
  }

  revalidatePath(`/jobs/${params.jobId}`);
  revalidatePath(`/jobs/${params.jobId}/contract`);
  return { success: true };
}

export async function getContractPdfSignedUrl(storagePath: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.storage
    .from("contract-pdfs")
    .createSignedUrl(storagePath, 3600);

  return data?.signedUrl ?? null;
}

/** Backfill PDF for signed contracts created before PDF generation existed. */
export async function ensureSignedContractPdf(
  contractId: string
): Promise<{ pdfPath: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: contract } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .single();

  if (!contract || contract.status !== "signed") {
    return { pdfPath: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile || contract.profile_id !== profile.id) {
    return { pdfPath: null };
  }

  if (contract.pdf_path) {
    return { pdfPath: contract.pdf_path };
  }

  const { generateSignedContractPdf, contractDbRowToPdfInput } = await import(
    "@/lib/contract-pdf"
  );
  const pdfPath = await generateSignedContractPdf(contractDbRowToPdfInput(contract));
  if (pdfPath) {
    await supabase.from("contracts").update({ pdf_path: pdfPath }).eq("id", contractId);
    revalidatePath(`/jobs/${contract.job_id}`);
    revalidatePath(`/jobs/${contract.job_id}/contract`);
  }
  return { pdfPath: pdfPath ?? null };
}

// =============================================================================
// Change orders (Phase 3)
// =============================================================================

export async function getChangeOrders(jobId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: job } = await supabase
    .from("jobs")
    .select("id, profile_id")
    .eq("id", jobId)
    .single();

  if (!job) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile || job.profile_id !== profile.id) return [];

  const { data } = await supabase
    .from("change_orders")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function getChangeOrder(changeOrderId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: co } = await supabase
    .from("change_orders")
    .select("*")
    .eq("id", changeOrderId)
    .single();

  if (!co) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile || co.profile_id !== profile.id) return null;
  return co;
}

export async function createChangeOrder(
  jobId: string,
  params: {
    changeTitle: string;
    changeDescription: string;
    reasonForChange?: string;
    /** New total contract price for the job after this change (stored as revised_total_price). */
    newJobTotal: number;
    newEstimatedCompletionDate: string;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const titleErr = validateChangeOrderTitle(params.changeTitle);
  if (titleErr) return { fieldErrors: { change_title: titleErr } };

  const descErr = validateChangeOrderDescription(params.changeDescription);
  if (descErr) return { fieldErrors: { change_description: descErr } };

  const completionDateErr = validateChangeOrderNewCompletionDate(
    params.newEstimatedCompletionDate
  );
  if (completionDateErr) {
    return { fieldErrors: { new_estimated_completion_date: completionDateErr } };
  }

  const totalRes = parseNewJobTotal(params.newJobTotal);
  if (!totalRes.ok) return { fieldErrors: { new_job_total: totalRes.message } };

  const { data: job } = await supabase
    .from("jobs")
    .select("id, profile_id, original_contract_price, current_contract_total, approved_change_total")
    .eq("id", jobId)
    .single();

  if (!job) return { error: "Job not found" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile || job.profile_id !== profile.id) {
    return { error: "Unauthorized" };
  }

  const previousTotal = Number(job.current_contract_total ?? job.original_contract_price ?? 0);
  const newTotal = totalRes.value;
  const changeAmount = newTotal - previousTotal;

  const { data, error } = await supabase
    .from("change_orders")
    .insert({
      job_id: jobId,
      profile_id: profile.id,
      change_title: params.changeTitle.trim(),
      change_description: params.changeDescription.trim(),
      reason_for_change: params.reasonForChange?.trim() || null,
      original_contract_price: previousTotal,
      change_amount: changeAmount,
      revised_total_price: newTotal,
      new_estimated_start_date: null,
      new_estimated_completion_date: params.newEstimatedCompletionDate.trim(),
      status: "draft",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}/change-orders`);
  revalidatePath(`/jobs/${jobId}/change-orders/${data.id}`);
  return { changeOrderId: data.id };
}

export async function sendChangeOrderForSigning(
  changeOrderId: string,
  options?: { deliveryMethod?: "email" | "device" }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: co } = await supabase
    .from("change_orders")
    .select("id, job_id, profile_id, status")
    .eq("id", changeOrderId)
    .single();

  if (!co) return { error: "Change order not found" };
  if (co.status !== "draft") return { error: "Change order must be in draft status" };

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, business_name, phone, address_line_1, city, province, postal_code"
    )
    .eq("user_id", user.id)
    .single();

  if (!profile || co.profile_id !== profile.id) {
    return { error: "Unauthorized" };
  }
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
        "Please complete your business profile before proceeding. Go to Settings → Business.",
    };
  }

  const { error } = await supabase
    .from("change_orders")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      sent_delivery_method: options?.deliveryMethod ?? null,
    })
    .eq("id", changeOrderId);

  if (error) return { error: error.message };
  revalidatePath(`/jobs/${co.job_id}`);
  revalidatePath(`/jobs/${co.job_id}/change-orders`);
  revalidatePath(`/jobs/${co.job_id}/change-orders/${changeOrderId}`);
  return { success: true };
}

export async function withdrawChangeOrderToDraft(changeOrderId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: co } = await supabase
    .from("change_orders")
    .select("id, job_id, profile_id, status")
    .eq("id", changeOrderId)
    .single();

  if (!co) return { error: "Change order not found" };
  if (co.status !== "sent") {
    return { error: "Only change orders awaiting approval can be moved back to draft." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile || co.profile_id !== profile.id) {
    return { error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("change_orders")
    .update({
      status: "draft",
      sent_at: null,
      sent_delivery_method: null,
    })
    .eq("id", changeOrderId)
    .eq("status", "sent");

  if (error) return { error: error.message };

  const { error: tokenDeleteError } = await supabase
    .from("change_order_signing_tokens")
    .delete()
    .eq("change_order_id", changeOrderId)
    .is("used_at", null);

  if (tokenDeleteError) {
    console.error("withdrawChangeOrderToDraft: token cleanup", tokenDeleteError);
  }

  revalidatePath(`/jobs/${co.job_id}`);
  revalidatePath(`/jobs/${co.job_id}/change-orders`);
  revalidatePath(`/jobs/${co.job_id}/change-orders/${changeOrderId}`);
  return { success: true };
}

export type ChangeOrderUpdatePayload = {
  changeTitle: string;
  changeDescription: string;
  reasonForChange?: string;
  newJobTotal: number;
  newEstimatedCompletionDate: string;
};

export async function updateChangeOrder(changeOrderId: string, params: ChangeOrderUpdatePayload) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const titleErr = validateChangeOrderTitle(params.changeTitle);
  if (titleErr) return { fieldErrors: { change_title: titleErr } };

  const descErr = validateChangeOrderDescription(params.changeDescription);
  if (descErr) return { fieldErrors: { change_description: descErr } };

  const completionDateErr = validateChangeOrderNewCompletionDate(
    params.newEstimatedCompletionDate
  );
  if (completionDateErr) {
    return { fieldErrors: { new_estimated_completion_date: completionDateErr } };
  }

  const totalRes = parseNewJobTotal(params.newJobTotal);
  if (!totalRes.ok) return { fieldErrors: { new_job_total: totalRes.message } };

  const { data: co } = await supabase
    .from("change_orders")
    .select("id, job_id, profile_id, status, original_contract_price")
    .eq("id", changeOrderId)
    .single();

  if (!co) return { error: "Change order not found" };
  if (co.status !== "draft") {
    return {
      error:
        "This change order can’t be edited while it’s awaiting customer approval. Move it back to draft first.",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile || co.profile_id !== profile.id) {
    return { error: "Unauthorized" };
  }

  const previousSnapshot = Number(co.original_contract_price ?? 0);
  const newTotal = totalRes.value;
  const changeAmount = newTotal - previousSnapshot;

  const { error } = await supabase
    .from("change_orders")
    .update({
      change_title: params.changeTitle.trim(),
      change_description: params.changeDescription.trim(),
      reason_for_change: params.reasonForChange?.trim() || null,
      change_amount: changeAmount,
      revised_total_price: newTotal,
      new_estimated_start_date: null,
      new_estimated_completion_date: params.newEstimatedCompletionDate.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", changeOrderId);

  if (error) return { error: error.message };
  revalidatePath(`/jobs/${co.job_id}`);
  revalidatePath(`/jobs/${co.job_id}/change-orders`);
  revalidatePath(`/jobs/${co.job_id}/change-orders/${changeOrderId}`);
  return { success: true };
}

export async function signChangeOrderDevice(
  changeOrderId: string,
  params: {
    signerName: string;
    signerEmail: string;
    signerPhone?: string;
    consentCheckbox: boolean;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const headersList = await headers();
  const ip = clientIpFromRequestHeaders(headersList);
  const userAgent = headersList.get("user-agent")?.trim() || null;

  const { data, error } = await supabase.rpc("sign_change_order_device", {
    p_change_order_id: changeOrderId,
    p_signer_name: params.signerName,
    p_signer_email: params.signerEmail,
    p_signer_phone: params.signerPhone ?? null,
    p_consent_checkbox: params.consentCheckbox,
    p_signed_ip_address: ip,
    p_signed_user_agent: userAgent,
  });

  if (error) return { error: error.message };
  const result = data as { success: boolean; error?: string; change_order_id?: string } | null;
  if (!result?.success) return { error: result?.error ?? "Signing failed" };

  if (result.change_order_id) {
    await deliverSignedChangeOrder(result.change_order_id);
  }

  const { data: co } = await supabase
    .from("change_orders")
    .select("job_id")
    .eq("id", changeOrderId)
    .single();

  if (co) {
    revalidatePath(`/jobs/${co.job_id}`);
    revalidatePath(`/jobs/${co.job_id}/change-orders`);
  }
  return { success: true };
}

export type ChangeOrderSigningPageData = {
  change_order_id: string;
  job_id: string;
  change_title: string | null;
  change_description: string | null;
  reason_for_change: string | null;
  original_contract_price: number | null;
  change_amount: number | null;
  revised_total_price: number | null;
  job_title: string | null;
  customer_name: string | null;
  expires_at: string;
};

export type ChangeOrderSigningPageResolution =
  | { outcome: "ok"; data: ChangeOrderSigningPageData }
  | { outcome: "invalid" | "withdrawn" | "expired" | "used" };

/** Public signing page: full outcome (withdrawn / expired / etc.) for UX; requires migration 017. */
export async function resolveChangeOrderSigningPage(
  token: string
): Promise<ChangeOrderSigningPageResolution> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_change_order_signing_token", {
    p_token: token.trim(),
  });

  if (error || data == null || typeof data !== "object") {
    return { outcome: "invalid" };
  }

  const row = data as Record<string, unknown>;
  const outcomeRaw = String(row.outcome ?? "invalid");

  if (outcomeRaw === "ok") {
    return {
      outcome: "ok",
      data: {
        change_order_id: String(row.change_order_id ?? ""),
        job_id: String(row.job_id ?? ""),
        change_title: (row.change_title as string | null) ?? null,
        change_description: (row.change_description as string | null) ?? null,
        reason_for_change: (row.reason_for_change as string | null) ?? null,
        original_contract_price:
          row.original_contract_price != null ? Number(row.original_contract_price) : null,
        change_amount: row.change_amount != null ? Number(row.change_amount) : null,
        revised_total_price:
          row.revised_total_price != null ? Number(row.revised_total_price) : null,
        job_title: (row.job_title as string | null) ?? null,
        customer_name: (row.customer_name as string | null) ?? null,
        expires_at: String(row.expires_at ?? ""),
      },
    };
  }

  if (
    outcomeRaw === "withdrawn" ||
    outcomeRaw === "expired" ||
    outcomeRaw === "used" ||
    outcomeRaw === "invalid"
  ) {
    return {
      outcome: outcomeRaw as "withdrawn" | "expired" | "used" | "invalid",
    };
  }

  return { outcome: "invalid" };
}

/** @deprecated Prefer resolveChangeOrderSigningPage for correct withdrawn/invalid messaging */
export async function getChangeOrderBySigningToken(token: string) {
  const res = await resolveChangeOrderSigningPage(token);
  if (res.outcome !== "ok") return null;
  return res.data;
}

export async function signChangeOrderRemote(
  token: string,
  params: {
    signerName: string;
    signerEmail: string;
    signerPhone?: string;
    consentCheckbox: boolean;
  }
) {
  const supabase = await createClient();
  const headersList = await headers();
  const ip = clientIpFromRequestHeaders(headersList);
  const userAgent = headersList.get("user-agent")?.trim() || null;

  const { data, error } = await supabase.rpc("sign_change_order_remote", {
    p_token: token,
    p_signer_name: params.signerName.trim(),
    p_signer_email: params.signerEmail.trim(),
    p_signer_phone: params.signerPhone?.trim() ?? null,
    p_consent_checkbox: params.consentCheckbox,
    p_signed_ip_address: ip,
    p_signed_user_agent: userAgent,
  });

  if (error) return { error: error.message };
  const result = data as { success: boolean; error?: string; change_order_id?: string } | null;
  if (!result?.success) return { error: result?.error ?? "Signing failed" };

  if (result.change_order_id) {
    await deliverSignedChangeOrder(result.change_order_id);
  }
  return { success: true };
}

export async function createChangeOrderSigningToken(changeOrderId: string, expiresInDays = 7) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: co } = await supabase
    .from("change_orders")
    .select("id, profile_id")
    .eq("id", changeOrderId)
    .single();

  if (!co) return { error: "Change order not found" };
  if (co.profile_id === null) return { error: "Change order not found" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile || co.profile_id !== profile.id) {
    return { error: "Unauthorized" };
  }

  const token = generateUUID() + generateUUID().replace(/-/g, "");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const { data, error } = await supabase
    .from("change_order_signing_tokens")
    .insert({
      change_order_id: changeOrderId,
      token,
      expires_at: expiresAt.toISOString(),
    })
    .select("token, expires_at")
    .single();

  if (error) return { error: error.message };
  return { token: data.token, expiresAt: data.expires_at };
}

/**
 * Email signing link for a change order. Requires valid customer email on the job.
 * If the change order is still draft, marks it sent (same rules as sendChangeOrderForSigning).
 */
export async function sendChangeOrderRemoteSigningLink(params: {
  changeOrderId: string;
  publicOrigin?: string;
}): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: co } = await supabase
    .from("change_orders")
    .select("id, job_id, profile_id, status, change_title")
    .eq("id", params.changeOrderId)
    .single();

  if (!co) return { error: "Change order not found" };

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, business_name, phone, address_line_1, city, province, postal_code"
    )
    .eq("user_id", user.id)
    .single();

  if (!profile || co.profile_id !== profile.id) {
    return { error: "Unauthorized" };
  }

  const { data: jobRow } = await supabase
    .from("jobs")
    .select("id, customer_id")
    .eq("id", co.job_id)
    .single();

  if (!jobRow?.customer_id) return { error: "Job not found" };

  const { data: cust } = await supabase
    .from("customers")
    .select("email, full_name")
    .eq("id", jobRow.customer_id)
    .eq("profile_id", profile.id)
    .maybeSingle();

  const emailErr = validateCustomerEmailForChangeOrderRemote(cust?.email ?? "");
  if (emailErr) {
    return { error: emailErr };
  }

  if (co.status === "draft") {
    const sendResult = await sendChangeOrderForSigning(params.changeOrderId, {
      deliveryMethod: "email",
    });
    if (sendResult?.error) return { error: sendResult.error };
  } else if (co.status !== "sent") {
    return { error: "Change order must be a draft or awaiting approval" };
  }

  const tokenResult = await createChangeOrderSigningToken(params.changeOrderId, 7);
  if (tokenResult?.error || !tokenResult?.token) {
    return { error: tokenResult?.error ?? "Failed to create signing link" };
  }

  const baseUrl = resolvePublicAppOrigin(params.publicOrigin);
  const signingUrl = `${baseUrl}/change-order-sign/${tokenResult.token}`;

  const coLinkEmail = await sendSigningLinkEmail({
    toEmail: String(cust?.email ?? "").trim(),
    toName: cust?.full_name?.trim() || "Customer",
    signingUrl,
    jobTitle: co.change_title ?? "Change order",
    expiresAt: new Date(tokenResult.expiresAt),
    businessDisplayName: profile.business_name ?? null,
    deliveryLog: {
      profileId: profile.id,
      type: "change_order",
      relatedEntityId: params.changeOrderId,
    },
  });
  if (!coLinkEmail.success) {
    return { error: coLinkEmail.error ?? "Failed to send signing email" };
  }

  revalidatePath(`/jobs/${co.job_id}`);
  revalidatePath(`/jobs/${co.job_id}/change-orders`);
  return { success: true };
}

async function deliverSignedChangeOrder(changeOrderId: string) {
  const supabase = await createClient();
  const { data: co } = await supabase
    .from("change_orders")
    .select("*")
    .eq("id", changeOrderId)
    .single();

  if (!co) return;

  const { data: job } = await supabase
    .from("jobs")
    .select("id, title")
    .eq("id", co.job_id)
    .single();

  const { data: jobWithCustomer } = await supabase
    .from("jobs")
    .select("customers(full_name, email)")
    .eq("id", co.job_id)
    .single();

  const customer = (jobWithCustomer as { customers?: { full_name?: string; email?: string } })?.customers;

  const { generateSignedChangeOrderPdf } = await import("@/lib/contract-pdf");
  const { sendSignedChangeOrderEmail } = await import("@/lib/delivery-service");

  const pdfPath = await generateSignedChangeOrderPdf({
    changeOrderId,
    changeTitle: co.change_title ?? "Change order",
    changeDescription: co.change_description ?? undefined,
    originalContractPrice: Number(co.original_contract_price ?? 0),
    changeAmount: Number(co.change_amount ?? 0),
    revisedTotalPrice: Number(co.revised_total_price ?? 0),
    jobTitle: job?.title ?? "",
    customerName: customer?.full_name ?? "",
    signedAt: co.signed_at ?? undefined,
    signerName: co.signer_name ?? undefined,
  });

  if (pdfPath) {
    await supabase
      .from("change_orders")
      .update({ pdf_path: pdfPath })
      .eq("id", changeOrderId);
  }

  const customerEmail = co.signer_email ?? (customer as { email?: string })?.email;
  if (customerEmail) {
    await sendSignedChangeOrderEmail({
      toEmail: customerEmail,
      toName: co.signer_name ?? (customer as { full_name?: string })?.full_name ?? "Customer",
      changeOrderTitle: co.change_title ?? "Change order",
      jobTitle: (job as { title?: string })?.title ?? "",
      pdfUrl: undefined,
      recipient: "customer",
      deliveryLog: {
        profileId: co.profile_id as string,
        type: "change_order",
        relatedEntityId: changeOrderId,
      },
    });
  }
}

export async function getChangeOrderPdfSignedUrl(storagePath: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.storage
    .from("contract-pdfs")
    .createSignedUrl(storagePath, 3600);

  return data?.signedUrl ?? null;
}

export async function getChangeOrderDownloadUrl(changeOrderId: string) {
  const co = await getChangeOrder(changeOrderId);
  if (!co?.pdf_path) return null;
  return getChangeOrderPdfSignedUrl(co.pdf_path);
}

// =============================================================================
// Invoices (Phase 3)
// =============================================================================

export async function getInvoices(jobId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: job } = await supabase
    .from("jobs")
    .select("id, profile_id")
    .eq("id", jobId)
    .single();

  if (!job) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile || job.profile_id !== profile.id) return [];

  const { data } = await supabase
    .from("invoices")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

/**
 * Create invoice from signed job totals only (contract + signed change orders on the job).
 * Amounts are computed server-side; the client may only adjust tax rate, due date, and notes.
 */
export async function createInvoice(
  jobId: string,
  taxRate: number,
  dueDate?: string,
  notes?: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const contract = await getContractForJob(jobId);
  if (!contract || contract.status !== "signed") {
    return {
      error:
        "Invoices from agreed amounts require a signed contract. Complete signing first.",
    };
  }

  const { data: job } = await supabase
    .from("jobs")
    .select(
      "id, profile_id, deposit_amount, current_contract_total, original_contract_price, tax_rate"
    )
    .eq("id", jobId)
    .single();

  if (!job) return { error: "Job not found" };

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, business_name, phone, address_line_1, city, province, postal_code"
    )
    .eq("user_id", user.id)
    .single();

  if (!profile || job.profile_id !== profile.id) {
    return { error: "Unauthorized" };
  }
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
        "Please complete your business profile before proceeding. Go to Settings → Business.",
    };
  }

  const agreedWorkSubtotal = Number(
    job.current_contract_total ?? job.original_contract_price ?? 0
  );
  if (!Number.isFinite(agreedWorkSubtotal) || agreedWorkSubtotal <= 0) {
    return {
      error:
        "This job has no positive agreed work total. Check the contract and signed change orders.",
    };
  }

  const rate = resolveInvoiceTaxRate(taxRate, job.tax_rate as number | null | undefined);
  const depositRaw = Number(job.deposit_amount ?? 0);
  const depositOnFile = Number.isFinite(depositRaw) && depositRaw > 0 ? depositRaw : 0;

  const subtotal = agreedWorkSubtotal;
  const taxAmount = Math.round(subtotal * rate * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;
  const depositCredited = Math.min(depositOnFile, total);
  const balanceDue = Math.round((total - depositCredited) * 100) / 100;

  const lineItems = [
    {
      description: "Agreed work (signed contract & change orders)",
      amount: agreedWorkSubtotal,
      quantity: 1,
    },
  ];

  const notesTrimmed = notes?.trim() || null;
  const issuedAt = new Date().toISOString();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      job_id: jobId,
      profile_id: profile.id,
      line_items: lineItems,
      agreed_work_subtotal: agreedWorkSubtotal,
      subtotal,
      tax_amount: taxAmount,
      total,
      deposit_credited: depositCredited,
      balance_due: balanceDue,
      due_date: dueDate || null,
      notes: notesTrimmed,
      status: "sent",
      sent_at: issuedAt,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (invoice?.id) {
    const lineItemRows = lineItems.map((item, i) => ({
      invoice_id: invoice.id,
      description: item.description,
      amount: item.amount,
      quantity: item.quantity ?? 1,
      sort_order: i,
    }));
    await supabase.from("invoice_line_items").insert(lineItemRows);
  }

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}/invoices`);
  return { invoiceId: invoice.id };
}
