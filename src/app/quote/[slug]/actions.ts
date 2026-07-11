"use server";

import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { generateUUID } from "@/lib/utils/uuid";
import { QUOTE_REQUEST_STORAGE_BUCKET } from "@/lib/quote-requests/constants";
import {
  buildQuotePhotoTmpPath,
  extFromQuotePhotoMime,
  isQuoteUploadSessionId,
  isValidQuotePhotoTmpPath,
  validateQuotePhotoMeta,
  validateQuotePhotoPathList,
} from "@/lib/quote-requests/photo-upload";
import { getContractorByQuoteSlug } from "@/lib/quote-requests/public";
import { sendQuoteRequestReceivedEmail } from "@/lib/quote-requests/notifications";
import { maybeGenerateProjectBrief } from "@/lib/quote-requests/project-brief/persist";
import { triggerQuoteChecklistGeneration } from "@/lib/quote-requests/quote-checklist/persist";
import {
  PRODUCT_ANALYTICS_EVENTS,
  trackProductEventSafe,
} from "@/lib/product-analytics";
import { validatePublicQuoteRequestFields } from "@/lib/validation/public-quote-request";
import {
  assertStorageQuotaAvailable,
  incrementStorageUsage,
} from "@/lib/storage-quota";

export type SubmitQuoteRequestResult =
  | { success: true; requestId: string }
  | { success: false; error: string };

export type CreateQuotePhotoUploadUrlResult =
  | { success: true; path: string; token: string }
  | { success: false; error: string };

export type DeleteQuotePhotoUploadResult =
  | { success: true }
  | { success: false; error: string };

export type SubmitPublicQuoteRequestInput = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  propertyAddress: string;
  projectType: string;
  description: string;
  isUrgent: boolean;
  uploadSessionId: string;
  photoPaths: string[];
};

export async function createQuotePhotoUploadUrl(
  slug: string,
  uploadSessionId: string,
  meta: { fileName: string; mimeType: string; byteSize: number }
): Promise<CreateQuotePhotoUploadUrlResult> {
  const contractor = await getContractorByQuoteSlug(slug);
  if (!contractor) {
    return { success: false, error: "This quote page is not available." };
  }
  if (!isQuoteUploadSessionId(uploadSessionId)) {
    return { success: false, error: "Invalid upload session." };
  }

  const metaCheck = validateQuotePhotoMeta(meta);
  if (!metaCheck.ok) {
    return { success: false, error: metaCheck.error };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { success: false, error: "Unable to upload photos right now. Please try again." };
  }

  const quota = await assertStorageQuotaAvailable(
    admin,
    contractor.id,
    {
      plan_tier: contractor.plan_tier,
      beta_tester: contractor.beta_tester,
      beta_plan_tier: contractor.beta_plan_tier,
    },
    meta.byteSize
  );
  if (!quota.ok) {
    return {
      success: false,
      error: "This contractor cannot accept more photo uploads right now. Please try again later.",
    };
  }

  const fileId = generateUUID();
  const ext = extFromQuotePhotoMime(metaCheck.mime);
  const path = buildQuotePhotoTmpPath(contractor.id, uploadSessionId, fileId, ext);

  const { data, error } = await admin.storage
    .from(QUOTE_REQUEST_STORAGE_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data?.token) {
    console.error("[createQuotePhotoUploadUrl]", error);
    return { success: false, error: "Could not prepare photo upload. Please try again." };
  }

  return { success: true, path: data.path ?? path, token: data.token };
}

export async function deleteQuotePhotoUpload(
  slug: string,
  uploadSessionId: string,
  filePath: string
): Promise<DeleteQuotePhotoUploadResult> {
  const contractor = await getContractorByQuoteSlug(slug);
  if (!contractor) {
    return { success: false, error: "This quote page is not available." };
  }
  if (!isQuoteUploadSessionId(uploadSessionId)) {
    return { success: false, error: "Invalid upload session." };
  }
  if (!isValidQuotePhotoTmpPath(filePath, contractor.id, uploadSessionId)) {
    return { success: false, error: "Invalid photo reference." };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { success: false, error: "Unable to remove photo right now." };
  }

  const { error } = await admin.storage.from(QUOTE_REQUEST_STORAGE_BUCKET).remove([filePath]);
  if (error) {
    console.error("[deleteQuotePhotoUpload]", error);
    return { success: false, error: "Could not remove photo." };
  }

  return { success: true };
}

export async function submitPublicQuoteRequest(
  slug: string,
  input: SubmitPublicQuoteRequestInput
): Promise<SubmitQuoteRequestResult> {
  const contractor = await getContractorByQuoteSlug(slug);
  if (!contractor) {
    return { success: false, error: "This quote page is not available." };
  }

  if (!isQuoteUploadSessionId(input.uploadSessionId)) {
    return { success: false, error: "Invalid upload session." };
  }

  const photoPaths = input.photoPaths.filter((p) => typeof p === "string" && p.trim().length > 0);

  const validation = validatePublicQuoteRequestFields({
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    propertyAddress: input.propertyAddress,
    projectType: input.projectType,
    description: input.description,
    photoCount: photoPaths.length,
  });
  if (!validation.ok) {
    return { success: false, error: validation.error };
  }

  const pathValidation = validateQuotePhotoPathList(
    photoPaths,
    contractor.id,
    input.uploadSessionId
  );
  if (!pathValidation.ok) {
    return { success: false, error: pathValidation.error };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { success: false, error: "Unable to submit your request right now. Please try again." };
  }

  const requestId = generateUUID();
  const followUpToken = generateUUID();
  const submittedAt = new Date().toISOString();

  const { error: insertError } = await admin.from("quote_requests").insert({
    id: requestId,
    contractor_id: contractor.id,
    follow_up_token: followUpToken,
    status: "new",
    customer_name: input.customerName.trim(),
    customer_email: input.customerEmail.trim(),
    customer_phone: input.customerPhone.trim() || null,
    property_address: input.propertyAddress.trim(),
    project_type: input.projectType.trim(),
    description: input.description.trim(),
    is_urgent: input.isUrgent,
    submitted_at: submittedAt,
  });

  if (insertError) {
    console.error("[submitPublicQuoteRequest] insert failed", insertError);
    return { success: false, error: "Could not save your request. Please try again." };
  }

  let photoCount = 0;
  let photoBytes = 0;

  for (const tmpPath of photoPaths) {
    const attachmentId = generateUUID();
    const ext = tmpPath.split(".").pop()?.toLowerCase() || "jpg";
    const finalPath = `${contractor.id}/${requestId}/${attachmentId}.${ext}`;

    let fileBytes = 0;
    try {
      const { data: blob } = await admin.storage
        .from(QUOTE_REQUEST_STORAGE_BUCKET)
        .download(tmpPath);
      if (blob) fileBytes = blob.size;
    } catch {
      /* continue — size tracked best-effort */
    }

    if (fileBytes > 0) {
      const quota = await assertStorageQuotaAvailable(
        admin,
        contractor.id,
        {
          plan_tier: contractor.plan_tier,
          beta_tester: contractor.beta_tester,
          beta_plan_tier: contractor.beta_plan_tier,
        },
        fileBytes
      );
      if (!quota.ok) {
        await admin.storage.from(QUOTE_REQUEST_STORAGE_BUCKET).remove([tmpPath]);
        continue;
      }
    }

    const { error: moveError } = await admin.storage
      .from(QUOTE_REQUEST_STORAGE_BUCKET)
      .move(tmpPath, finalPath);

    if (moveError) {
      console.error("[submitPublicQuoteRequest] move failed", moveError, { tmpPath, finalPath });
      continue;
    }

    const { error: attachError } = await admin.from("quote_request_attachments").insert({
      id: attachmentId,
      quote_request_id: requestId,
      file_path: finalPath,
    });

    if (attachError) {
      console.error("[submitPublicQuoteRequest] attachment insert failed", attachError);
      continue;
    }

    photoCount += 1;
    photoBytes += fileBytes;
  }

  if (photoBytes > 0) {
    await incrementStorageUsage(admin, contractor.id, photoBytes);
  }

  void maybeGenerateProjectBrief(admin, requestId, "submission", false)
    .catch((err) => {
      console.error("[submitPublicQuoteRequest] project brief generation failed", err);
    })
    .finally(() => {
      triggerQuoteChecklistGeneration(admin, requestId, "submission", false);
    });

  const notificationPayload = {
    contractorId: contractor.id,
    requestId,
    customerName: input.customerName.trim(),
    customerEmail: input.customerEmail.trim(),
    customerPhone: input.customerPhone.trim() || null,
    propertyAddress: input.propertyAddress.trim(),
    projectType: input.projectType.trim(),
    description: input.description.trim(),
    isUrgent: input.isUrgent,
    photoCount,
    submittedAt,
  };

  trackProductEventSafe({
    profileId: contractor.id,
    eventName: PRODUCT_ANALYTICS_EVENTS.quote_request_received,
    route: `/quote/${contractor.quote_slug}`,
    source: "public_quote_form",
    metadata: {
      contractor_id: contractor.id,
      request_id: requestId,
      project_type: notificationPayload.projectType,
      urgent: input.isUrgent,
      photo_count: photoCount,
    },
  });

  const notificationResult = await sendQuoteRequestReceivedEmail(admin, notificationPayload);

  if (notificationResult.sent) {
    trackProductEventSafe({
      profileId: contractor.id,
      eventName: PRODUCT_ANALYTICS_EVENTS.quote_request_notification_sent,
      route: `/quote-requests/${requestId}`,
      source: "quote_request_notification",
      metadata: {
        contractor_id: contractor.id,
        request_id: requestId,
        urgent: input.isUrgent,
        photo_count: photoCount,
      },
    });
  } else {
    trackProductEventSafe({
      profileId: contractor.id,
      eventName: PRODUCT_ANALYTICS_EVENTS.quote_request_notification_failed,
      route: `/quote-requests/${requestId}`,
      source: "quote_request_notification",
      metadata: {
        contractor_id: contractor.id,
        request_id: requestId,
        reason: notificationResult.reason,
        urgent: input.isUrgent,
        photo_count: photoCount,
      },
    });
  }

  redirect(`/quote/${contractor.quote_slug}/success?rid=${requestId}&ft=${followUpToken}`);
}
