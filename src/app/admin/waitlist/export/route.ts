import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireAdminUser } from "@/lib/admin-auth";
import {
  filterWaitlistRows,
  parseWaitlistRows,
  sortWaitlistNewestFirst,
  waitlistRowsToCsv,
  type WaitlistFilters,
} from "@/lib/admin-waitlist";

function firstStringFromUrl(searchParams: URLSearchParams, key: string): string {
  return String(searchParams.get(key) ?? "").trim();
}

export async function GET(req: Request) {
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const urlBase = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!urlBase || !key) {
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  const admin = createServiceClient(urlBase, key);
  const { searchParams } = new URL(req.url);

  const filters: WaitlistFilters = {
    q: firstStringFromUrl(searchParams, "q"),
    province: firstStringFromUrl(searchParams, "province"),
    source: firstStringFromUrl(searchParams, "source"),
  };

  const { data: raw, error } = await admin.from("waitlist_signups").select("*");
  if (error) {
    console.warn("[admin/waitlist/export]", error.message);
    return new NextResponse("Could not load waitlist", { status: 500 });
  }

  const rows = sortWaitlistNewestFirst(parseWaitlistRows(Array.isArray(raw) ? raw : []));
  const filtered = filterWaitlistRows(rows, filters);
  const csv = waitlistRowsToCsv(filtered);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="jobproof-waitlist-export.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
