import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getContractorByQuoteSlug } from "@/lib/quote-requests/public";

export type FollowUpQuoteRequestContext = {
  requestId: string;
  contractorId: string;
  projectType: string;
  description: string;
  customerName: string;
};

export async function verifyFollowUpAccess(
  slug: string,
  requestId: string,
  token: string
): Promise<FollowUpQuoteRequestContext | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  const normalizedToken = token.trim();
  const normalizedRequestId = requestId.trim();

  if (!normalizedSlug || !normalizedToken || !normalizedRequestId) {
    return null;
  }

  const contractor = await getContractorByQuoteSlug(normalizedSlug);
  if (!contractor) return null;

  const admin = createServiceRoleClient();
  if (!admin) return null;

  const { data: request } = await admin
    .from("quote_requests")
    .select("id, contractor_id, project_type, description, customer_name, follow_up_token")
    .eq("id", normalizedRequestId)
    .eq("contractor_id", contractor.id)
    .maybeSingle();

  if (!request?.id || String(request.follow_up_token) !== normalizedToken) {
    return null;
  }

  return {
    requestId: String(request.id),
    contractorId: String(request.contractor_id),
    projectType: String(request.project_type),
    description: String(request.description),
    customerName: String(request.customer_name),
  };
}
