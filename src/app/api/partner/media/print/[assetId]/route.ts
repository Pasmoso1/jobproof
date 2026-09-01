import { NextRequest } from "next/server";
import { buildPartnerReferralUrl } from "@/lib/partners/constants";
import { isPrintAssetId } from "@/lib/partners/print-assets";
import { personalizePrintAsset } from "@/lib/partners/print-personalize";
import { getActivePartnerForCurrentUser } from "@/lib/partners/session";
import { resolveAppUrl } from "@/lib/stripe";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ assetId: string }> }
) {
  const session = await getActivePartnerForCurrentUser();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { assetId } = await context.params;
  if (!isPrintAssetId(assetId)) {
    return new Response("Not found", { status: 404 });
  }

  const formatParam = request.nextUrl.searchParams.get("format");
  const format = formatParam === "pdf" ? "pdf" : "png";

  const referralUrl = buildPartnerReferralUrl(
    resolveAppUrl(),
    session.partner.referral_code
  );

  try {
    const { bytes, contentType, fileName } = await personalizePrintAsset({
      assetId,
      referralUrl,
      format,
    });

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to personalize asset";
    return new Response(message, { status: 500 });
  }
}
