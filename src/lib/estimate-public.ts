import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { formatDateEastern, formatLocalDateStringEastern } from "@/lib/datetime-eastern";
import { notifyContractorOfEstimateFeedback, type EstimateCustomerFeedbackType } from "@/lib/estimate-customer-feedback";
import {
  deriveEstimateDisplayStatus,
  isEstimateOpenForCustomerResponse,
} from "@/lib/estimate-status";
import {
  buildCustomerProposalSnapshot,
  type CustomerProposalSnapshot,
} from "@/lib/public-estimate-proposal";
import { trackProductEventSafe, PRODUCT_ANALYTICS_EVENTS } from "@/lib/product-analytics";

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
  id: string;
  business_name: string | null;
  contractor_name: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  business_contact_email: string | null;
  quote_logo_url?: string | null;
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
  estimateId: string;
  profileId: string;
  quoteRequestId: string | null;
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
    logoUrl: string | null;
  };
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
  };
  propertyAddressLines: string[];
  hasPdf: boolean;
  proposal: CustomerProposalSnapshot;
};

function fallbackProposal(input: {
  title: string;
  scopeOfWork: string;
  notes: string | null;
  businessName: string;
  subtotal: number;
  taxAmount: number;
  taxRateLabel: string;
  total: number;
  depositAmount: number | null;
}): CustomerProposalSnapshot {
  const scopeItems = input.scopeOfWork
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);

  return buildCustomerProposalSnapshot({
    sections: [
      {
        id: "fallback-project-summary",
        quoteRequestId: "",
        contractorId: "",
        sectionKey: "project_summary",
        title: "Project Summary",
        content: { version: 1, items: [input.title] },
        displayOrder: 1,
        source: "generated",
        contractorEdited: false,
        contractorEditedAt: null,
        generatedAt: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "fallback-scope",
        quoteRequestId: "",
        contractorId: "",
        sectionKey: "scope_of_work",
        title: "Scope of Work",
        content: { version: 1, items: scopeItems.length ? scopeItems : [input.scopeOfWork || "Project work as discussed."] },
        displayOrder: 2,
        source: "generated",
        contractorEdited: false,
        contractorEditedAt: null,
        generatedAt: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "fallback-included",
        quoteRequestId: "",
        contractorId: "",
        sectionKey: "included_work",
        title: "Included Work",
        content: { version: 1, items: ["Project setup", "Completion of the quoted work", "Site cleanup"] },
        displayOrder: 3,
        source: "generated",
        contractorEdited: false,
        contractorEditedAt: null,
        generatedAt: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "fallback-upgrades",
        quoteRequestId: "",
        contractorId: "",
        sectionKey: "optional_upgrades",
        title: "Optional Upgrades",
        content: { version: 1, items: [] },
        displayOrder: 5,
        source: "generated",
        contractorEdited: false,
        contractorEditedAt: null,
        generatedAt: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "fallback-exclusions",
        quoteRequestId: "",
        contractorId: "",
        sectionKey: "exclusions",
        title: "Exclusions",
        content: { version: 1, items: [] },
        displayOrder: 6,
        source: "generated",
        contractorEdited: false,
        contractorEditedAt: null,
        generatedAt: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "fallback-timeline",
        quoteRequestId: "",
        contractorId: "",
        sectionKey: "suggested_timeline",
        title: "Timeline",
        content: {
          version: 1,
          text: "Scheduling will be confirmed after acceptance.",
        },
        displayOrder: 7,
        source: "generated",
        contractorEdited: false,
        contractorEditedAt: null,
        generatedAt: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "fallback-warranty",
        quoteRequestId: "",
        contractorId: "",
        sectionKey: "suggested_warranty",
        title: "Warranty",
        content: { version: 1, items: [] },
        displayOrder: 8,
        source: "generated",
        contractorEdited: false,
        contractorEditedAt: null,
        generatedAt: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "fallback-notes",
        quoteRequestId: "",
        contractorId: "",
        sectionKey: "recommended_next_steps",
        title: "Notes",
        content: {
          version: 1,
          items: input.notes ? [input.notes] : [],
        },
        displayOrder: 10,
        source: "generated",
        contractorEdited: false,
        contractorEditedAt: null,
        generatedAt: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "fallback-pricing",
        quoteRequestId: "",
        contractorId: "",
        sectionKey: "pricing",
        title: "Pricing",
        content: {
          version: 1,
          labour: "",
          materials: "",
          equipment: "",
          permits: "",
          other: "",
          subtotal: String(input.subtotal),
          tax: String(input.taxAmount),
          total: String(input.total),
        },
        displayOrder: 11,
        source: "generated",
        contractorEdited: false,
        contractorEditedAt: null,
        generatedAt: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
    projectTitle: input.title,
    businessName: input.businessName,
    subtotal: input.subtotal,
    taxAmount: input.taxAmount,
    taxRateLabel: input.taxRateLabel,
    total: input.total,
    depositAmount: input.depositAmount,
  });
}

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
      profile_id,
      title,
      quote_request_id,
      customer_proposal,
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
        id,
        business_name,
        contractor_name,
        phone,
        address_line_1,
        address_line_2,
        city,
        province,
        postal_code,
        business_contact_email,
        quote_logo_url
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
  const contractorEmail =
    profile.business_contact_email?.trim() || null;

  const expRaw = (row.expiry_date as string | null)?.trim() || null;
  const displayStatus = deriveEstimateDisplayStatus(status, expRaw);
  const canRespond = isEstimateOpenForCustomerResponse(status, expRaw);

  const pdfPath = (row.estimate_pdf_path as string | null)?.trim() || null;

  const proposalRaw =
    row.customer_proposal && typeof row.customer_proposal === "object"
      ? (row.customer_proposal as CustomerProposalSnapshot)
      : null;

  const proposal =
    proposalRaw ??
    fallbackProposal({
      title: String(row.title ?? "").trim() || "Project proposal",
      scopeOfWork: String(row.scope_of_work ?? "").trim(),
      notes: typeof row.notes === "string" ? row.notes.trim() || null : null,
      businessName: profile.business_name?.trim() || "Contractor",
      subtotal: Number(row.subtotal),
      taxAmount: Number(row.tax_amount),
      taxRateLabel: "Tax",
      total: Number(row.total),
      depositAmount:
        row.deposit_amount != null && Number(row.deposit_amount) > 0
          ? Number(row.deposit_amount)
          : null,
    });

  return {
    estimateId: String(row.id),
    profileId: String(row.profile_id),
    quoteRequestId: (row.quote_request_id as string | null) ?? null,
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
    taxRateLabel: proposal.taxRateLabel,
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
      logoUrl: profile.quote_logo_url?.trim() || null,
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
    proposal,
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
  const { data: updated } = await admin
    .from("estimates")
    .update({
      viewed_at: new Date().toISOString(),
      status: "viewed",
    })
    .eq("public_token", token.trim())
    .eq("status", "sent")
    .is("viewed_at", null)
    .select("id, profile_id")
    .maybeSingle();

  if (updated?.profile_id) {
    trackProductEventSafe({
      profileId: String(updated.profile_id),
      eventName: PRODUCT_ANALYTICS_EVENTS.quote_viewed,
      route: `/estimate/${token.trim()}`,
      source: "public_quote",
      metadata: { estimate_id: String(updated.id ?? "") || null },
    });
  }
}

export type PublicEstimateResponseResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "closed" | "expired" | "already_answered" | "invalid_message" };

async function insertQuoteRequestEventIfPresent(input: {
  quoteRequestId: string | null;
  contractorId: string;
  eventType: string;
  eventLabel: string;
  metadata?: Record<string, unknown>;
}) {
  if (!input.quoteRequestId) return;
  const admin = createServiceRoleClient();
  if (!admin) return;
  await admin.from("quote_request_events").insert({
    quote_request_id: input.quoteRequestId,
    contractor_id: input.contractorId,
    event_type: input.eventType,
    event_label: input.eventLabel,
    metadata: input.metadata ?? null,
  });
}

async function getEstimateForPublicResponse(token: string) {
  const admin = createServiceRoleClient();
  if (!admin) return null;
  const { data: row } = await admin
    .from("estimates")
    .select(
      `
      id,
      profile_id,
      title,
      status,
      expiry_date,
      quote_request_id,
      public_token,
      customers (
        full_name,
        email,
        phone
      ),
      profiles (
        id,
        business_name,
        contractor_name,
        phone,
        business_contact_email
      )
    `
    )
    .eq("public_token", token.trim())
    .maybeSingle();
  return row;
}

export async function acceptPublicEstimateByToken(
  token: string
): Promise<PublicEstimateResponseResult> {
  if (!isValidPublicEstimateToken(token)) return { ok: false, reason: "not_found" };
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, reason: "not_found" };

  const row = await getEstimateForPublicResponse(token);

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

  const customer = unwrapOne(row.customers as CustomerJoin | CustomerJoin[] | null);
  const profile = unwrapOne(row.profiles as ProfileJoin | ProfileJoin[] | null);
  if (profile) {
    await notifyContractorOfEstimateFeedback({
      profileId: String(row.profile_id),
      estimateId: String(row.id),
      quoteToken: token.trim(),
      contractorBusinessName: profile.business_name?.trim() || "Contractor",
      contractorEmail: profile.business_contact_email?.trim() || null,
      contractorPhone: profile.phone?.trim() || null,
      customerName: customer?.full_name?.trim() || "Customer",
      customerEmail: customer?.email?.trim() || null,
      customerPhone: customer?.phone?.trim() || null,
      estimateTitle: String(row.title ?? "Project quote"),
      type: "accepted",
      message: "The customer accepted this quote.",
    });
  }

  await insertQuoteRequestEventIfPresent({
    quoteRequestId: (row.quote_request_id as string | null) ?? null,
    contractorId: String(row.profile_id),
    eventType: "quote_accepted",
    eventLabel: "Customer accepted quote",
    metadata: { estimate_id: String(row.id) },
  });

  trackProductEventSafe({
    profileId: String(row.profile_id),
    eventName: PRODUCT_ANALYTICS_EVENTS.quote_accepted,
    route: `/estimate/${token.trim()}`,
    source: "public_quote",
    metadata: {
      estimate_id: String(row.id),
      quote_request_id: (row.quote_request_id as string | null) ?? null,
    },
  });

  return { ok: true };
}

export async function declinePublicEstimateByToken(
  token: string,
  message?: string
): Promise<PublicEstimateResponseResult> {
  if (!isValidPublicEstimateToken(token)) return { ok: false, reason: "not_found" };
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, reason: "not_found" };

  const row = await getEstimateForPublicResponse(token);

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

  const customer = unwrapOne(row.customers as CustomerJoin | CustomerJoin[] | null);
  const profile = unwrapOne(row.profiles as ProfileJoin | ProfileJoin[] | null);
  const trimmedMessage = String(message ?? "").trim();
  if (trimmedMessage) {
    await admin.from("estimate_customer_messages").insert({
      estimate_id: row.id,
      quote_request_id: row.quote_request_id ?? null,
      contractor_id: row.profile_id,
      message_type: "decline",
      customer_name: customer?.full_name?.trim() || null,
      customer_email: customer?.email?.trim() || null,
      customer_phone: customer?.phone?.trim() || null,
      message_text: trimmedMessage,
    });
  }

  await insertQuoteRequestEventIfPresent({
    quoteRequestId: (row.quote_request_id as string | null) ?? null,
    contractorId: String(row.profile_id),
    eventType: "quote_declined",
    eventLabel: "Customer declined quote",
    metadata: { estimate_id: String(row.id), message: trimmedMessage || null },
  });

  trackProductEventSafe({
    profileId: String(row.profile_id),
    eventName: PRODUCT_ANALYTICS_EVENTS.quote_declined,
    route: `/estimate/${token.trim()}`,
    source: "public_quote",
    metadata: {
      estimate_id: String(row.id),
      quote_request_id: (row.quote_request_id as string | null) ?? null,
    },
  });

  if (profile) {
    await notifyContractorOfEstimateFeedback({
      profileId: String(row.profile_id),
      estimateId: String(row.id),
      quoteToken: token.trim(),
      contractorBusinessName: profile.business_name?.trim() || "Contractor",
      contractorEmail: profile.business_contact_email?.trim() || null,
      contractorPhone: profile.phone?.trim() || null,
      customerName: customer?.full_name?.trim() || "Customer",
      customerEmail: customer?.email?.trim() || null,
      customerPhone: customer?.phone?.trim() || null,
      estimateTitle: String(row.title ?? "Project quote"),
      type: "decline",
      message: trimmedMessage || "The customer declined this quote.",
    });
  }

  return { ok: true };
}

async function submitEstimateCustomerFeedback(
  token: string,
  type: EstimateCustomerFeedbackType,
  message: string
): Promise<PublicEstimateResponseResult> {
  if (!isValidPublicEstimateToken(token)) return { ok: false, reason: "not_found" };
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, reason: "not_found" };

  const row = await getEstimateForPublicResponse(token);
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

  const trimmedMessage = message.trim();
  if (trimmedMessage.length < 5) {
    return { ok: false, reason: "invalid_message" };
  }

  const customer = unwrapOne(row.customers as CustomerJoin | CustomerJoin[] | null);
  const profile = unwrapOne(row.profiles as ProfileJoin | ProfileJoin[] | null);
  if (!profile) return { ok: false, reason: "closed" };

  await admin.from("estimate_customer_messages").insert({
    estimate_id: row.id,
    quote_request_id: row.quote_request_id ?? null,
    contractor_id: row.profile_id,
    message_type: type,
    customer_name: customer?.full_name?.trim() || null,
    customer_email: customer?.email?.trim() || null,
    customer_phone: customer?.phone?.trim() || null,
    message_text: trimmedMessage,
  });

  await insertQuoteRequestEventIfPresent({
    quoteRequestId: (row.quote_request_id as string | null) ?? null,
    contractorId: String(row.profile_id),
    eventType: type === "question" ? "quote_question_submitted" : "quote_change_request_submitted",
    eventLabel:
      type === "question" ? "Customer asked a question about the quote" : "Customer requested quote changes",
    metadata: { estimate_id: String(row.id), message: trimmedMessage },
  });

  await notifyContractorOfEstimateFeedback({
    profileId: String(row.profile_id),
    estimateId: String(row.id),
    quoteToken: token.trim(),
    contractorBusinessName: profile.business_name?.trim() || "Contractor",
    contractorEmail: profile.business_contact_email?.trim() || null,
    contractorPhone: profile.phone?.trim() || null,
    customerName: customer?.full_name?.trim() || "Customer",
    customerEmail: customer?.email?.trim() || null,
    customerPhone: customer?.phone?.trim() || null,
    estimateTitle: String(row.title ?? "Project quote"),
    type,
    message: trimmedMessage,
  });

  trackProductEventSafe({
    profileId: String(row.profile_id),
    eventName:
      type === "question"
        ? PRODUCT_ANALYTICS_EVENTS.quote_question_submitted
        : PRODUCT_ANALYTICS_EVENTS.quote_change_request_submitted,
    route: `/estimate/${token.trim()}`,
    source: "public_quote",
    metadata: {
      estimate_id: String(row.id),
      quote_request_id: (row.quote_request_id as string | null) ?? null,
    },
  });

  return { ok: true };
}

export async function submitEstimateQuestionByToken(
  token: string,
  message: string
): Promise<PublicEstimateResponseResult> {
  return submitEstimateCustomerFeedback(token, "question", message);
}

export async function requestEstimateChangesByToken(
  token: string,
  message: string
): Promise<PublicEstimateResponseResult> {
  return submitEstimateCustomerFeedback(token, "change_request", message);
}
