"use server";

import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { generateUUID } from "@/lib/utils/uuid";
import {
  MAX_QUOTE_REQUEST_PHOTO_BYTES,
  QUOTE_REQUEST_STORAGE_BUCKET,
} from "@/lib/quote-requests/constants";
import { getContractorByQuoteSlug } from "@/lib/quote-requests/public";
import { validatePublicQuoteRequestFields } from "@/lib/validation/public-quote-request";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "jpg";
  }
}

export type SubmitQuoteRequestResult =
  | { success: true; requestId: string }
  | { success: false; error: string };

export async function submitPublicQuoteRequest(
  slug: string,
  formData: FormData
): Promise<SubmitQuoteRequestResult> {
  const contractor = await getContractorByQuoteSlug(slug);
  if (!contractor) {
    return { success: false, error: "This quote page is not available." };
  }

  const customerName = String(formData.get("customerName") ?? "");
  const customerEmail = String(formData.get("customerEmail") ?? "");
  const customerPhone = String(formData.get("customerPhone") ?? "");
  const propertyAddress = String(formData.get("propertyAddress") ?? "");
  const projectType = String(formData.get("projectType") ?? "");
  const description = String(formData.get("description") ?? "");
  const isUrgent = formData.get("isUrgent") === "on" || formData.get("isUrgent") === "true";

  const photoFiles = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  const validation = validatePublicQuoteRequestFields({
    customerName,
    customerEmail,
    customerPhone,
    propertyAddress,
    projectType,
    description,
    photoCount: photoFiles.length,
  });
  if (!validation.ok) {
    return { success: false, error: validation.error };
  }

  for (const file of photoFiles) {
    const mime = (file.type || "image/jpeg").toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      return { success: false, error: "Photos must be JPEG, PNG, GIF, WebP, or HEIC." };
    }
    if (file.size > MAX_QUOTE_REQUEST_PHOTO_BYTES) {
      return { success: false, error: "Each photo must be 10 MB or smaller." };
    }
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { success: false, error: "Unable to submit your request right now. Please try again." };
  }

  const requestId = generateUUID();
  const submittedAt = new Date().toISOString();

  const { error: insertError } = await admin.from("quote_requests").insert({
    id: requestId,
    contractor_id: contractor.id,
    status: "new",
    customer_name: customerName.trim(),
    customer_email: customerEmail.trim(),
    customer_phone: customerPhone.trim() || null,
    property_address: propertyAddress.trim(),
    project_type: projectType.trim(),
    description: description.trim(),
    is_urgent: isUrgent,
    submitted_at: submittedAt,
  });

  if (insertError) {
    console.error("[submitPublicQuoteRequest] insert failed", insertError);
    return { success: false, error: "Could not save your request. Please try again." };
  }

  for (let i = 0; i < photoFiles.length; i++) {
    const file = photoFiles[i];
    const mime = (file.type || "image/jpeg").toLowerCase();
    const ext = extFromMime(mime);
    const attachmentId = generateUUID();
    const filePath = `${contractor.id}/${requestId}/${attachmentId}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage
      .from(QUOTE_REQUEST_STORAGE_BUCKET)
      .upload(filePath, buffer, {
        contentType: mime,
        upsert: false,
      });

    if (uploadError) {
      console.error("[submitPublicQuoteRequest] upload failed", uploadError);
      continue;
    }

    await admin.from("quote_request_attachments").insert({
      id: attachmentId,
      quote_request_id: requestId,
      file_path: filePath,
    });
  }

  redirect(`/quote/${contractor.quote_slug}/success`);
}
