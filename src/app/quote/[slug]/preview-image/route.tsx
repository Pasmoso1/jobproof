import { getContractorByQuoteSlug } from "@/lib/quote-requests/public";
import {
  buildQuoteLinkPreviewVersion,
  cleanBusinessName,
  fetchPreviewLogoDataUri,
} from "@/lib/quote-requests/link-preview";
import { renderQuoteLinkPreviewImage } from "@/lib/quote-requests/link-preview-image";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const contractor = await getContractorByQuoteSlug(slug);
  if (!contractor || !contractor.quote_ready) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const logoDataUri = await fetchPreviewLogoDataUri(contractor.quote_logo_url);
  const requestedVersion = new URL(request.url).searchParams.get("v");
  const isCurrentVersion = requestedVersion === buildQuoteLinkPreviewVersion(contractor);
  const logoMissingUnexpectedly = Boolean(contractor.quote_logo_url) && !logoDataUri;
  const cacheControl = !isCurrentVersion
    ? "no-store"
    : logoMissingUnexpectedly
      ? "public, max-age=300, s-maxage=300"
      : "public, max-age=86400, s-maxage=86400";

  return renderQuoteLinkPreviewImage({
    businessName: cleanBusinessName(contractor.business_name),
    tradeLabel: contractor.trade_label,
    logoDataUri,
    cacheControl,
  });
}
