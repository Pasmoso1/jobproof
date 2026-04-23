import { NextResponse } from "next/server";
import {
  fetchEstimatePdfByPublicToken,
  isValidPublicEstimateToken,
} from "@/lib/estimate-public";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function GET(
  _req: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  if (!isValidPublicEstimateToken(token)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const meta = await fetchEstimatePdfByPublicToken(token);
  if (!meta) {
    return new NextResponse("Not found", { status: 404 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return new NextResponse("Service unavailable", { status: 503 });
  }

  const { data, error } = await admin.storage.from("estimate-pdfs").download(meta.path);

  if (error || !data) {
    return new NextResponse("PDF unavailable", { status: 404 });
  }

  const buf = Buffer.from(await data.arrayBuffer());
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${meta.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
