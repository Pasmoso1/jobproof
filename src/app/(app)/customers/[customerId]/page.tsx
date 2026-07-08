import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
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

  if (!profile?.id) redirect("/login");

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!customer) notFound();

  const [{ data: jobs }, { data: estimates }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, title, status, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("estimates")
      .select("id, title, status, estimate_number, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const addressParts = [
    customer.address_line_1,
    customer.address_line_2,
    [customer.city, customer.province, customer.postal_code].filter(Boolean).join(", "),
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/quote-requests" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
          ← Back
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">{customer.full_name}</h1>
        <p className="mt-1 text-sm text-zinc-600">Customer record</p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Contact</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Email</dt>
            <dd className="font-medium text-zinc-900">
              {customer.email ? (
                <a href={`mailto:${customer.email}`} className="text-[#2436BB] hover:underline">
                  {customer.email}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Phone</dt>
            <dd className="font-medium text-zinc-900">
              {customer.phone ? (
                <a href={`tel:${customer.phone.replace(/\s/g, "")}`} className="text-[#2436BB] hover:underline">
                  {customer.phone}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500">Address</dt>
            <dd className="font-medium text-zinc-900">
              {addressParts.length ? addressParts.join(", ") : "—"}
            </dd>
          </div>
          {customer.notes ? (
            <div className="sm:col-span-2">
              <dt className="text-zinc-500">Notes</dt>
              <dd className="mt-1 whitespace-pre-wrap text-zinc-800">{customer.notes}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {estimates && estimates.length > 0 ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-base font-semibold text-zinc-900">Estimates</h2>
          <ul className="mt-3 divide-y divide-zinc-100">
            {estimates.map((est) => (
              <li key={est.id} className="flex items-center justify-between py-2 text-sm">
                <Link
                  href={`/estimates/${est.id}`}
                  className="font-medium text-[#2436BB] hover:underline"
                >
                  {est.title}
                </Link>
                <span className="text-zinc-500">{String(est.status)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {jobs && jobs.length > 0 ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-base font-semibold text-zinc-900">Jobs</h2>
          <ul className="mt-3 divide-y divide-zinc-100">
            {jobs.map((job) => (
              <li key={job.id} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/jobs/${job.id}`} className="font-medium text-[#2436BB] hover:underline">
                  {job.title}
                </Link>
                <span className="text-zinc-500">{String(job.status)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
