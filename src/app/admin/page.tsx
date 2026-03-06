/**
 * TEMPORARY: Simple password gate for internal admin access only.
 * Replace with proper authentication (e.g. Supabase Auth, NextAuth) before production.
 */

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "crypto";

const ADMIN_COOKIE = "admin_auth";
const COOKIE_SALT = "jobproof-admin-gate";

function getAuthToken(): string {
  const pwd = process.env.ADMIN_PASSWORD;
  if (!pwd) return "";
  return createHash("sha256").update(pwd + COOKIE_SALT).digest("hex");
}

function isAuthenticated(cookieValue: string | undefined): boolean {
  const expected = getAuthToken();
  return !!expected && cookieValue === expected;
}

async function loginAction(formData: FormData) {
  "use server";
  const password = formData.get("password");
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected || typeof password !== "string" || password !== expected) {
    redirect("/admin?error=invalid");
  }

  const token = getAuthToken();
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: 60 * 60 * 24,
  });

  redirect("/admin");
}

type WaitlistSignup = {
  created_at: string | null;
  email: string | null;
  trade: string | null;
  city: string | null;
  team_size: string | null;
  plan_interest: string | null;
  source: string | null;
  status: string | null;
};

async function getWaitlistSignups(): Promise<WaitlistSignup[]> {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return [];
  }

  const supabase = createClient(url, serviceRoleKey);

  const { data, error } = await supabase
    .from("waitlist_signups")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("ADMIN_WAITLIST_ERROR", error);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    created_at: (row.created_at as string) ?? null,
    email: (row.email as string) ?? null,
    trade: (row.trade as string) ?? null,
    city: (row.city as string) ?? null,
    team_size: (row.team_size as string) ?? null,
    plan_interest: (row.plan_interest as string) ?? null,
    source: (row.source as string) ?? null,
    status: (row.status as string) ?? null,
  }));
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function AdminLoginForm({ error }: { error?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <form
        action={loginAction}
        className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-lg font-semibold text-zinc-900">
          Admin access
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Enter the admin password to continue.
        </p>
        <input
          type="password"
          name="password"
          placeholder="Password"
          autoComplete="current-password"
          className="mt-4 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        {error && (
          <p className="mt-2 text-sm text-red-600">Invalid password.</p>
        )}
        <button
          type="submit"
          className="mt-4 w-full rounded-lg bg-zinc-900 px-4 py-2.5 font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get(ADMIN_COOKIE)?.value;

  if (!isAuthenticated(authCookie)) {
    const params = await searchParams;
    return <AdminLoginForm error={params.error} />;
  }

  const signups = await getWaitlistSignups();

  const byTrade = signups.reduce<Record<string, number>>((acc, s) => {
    const key = s.trade?.trim() || "(none)";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const byCity = signups.reduce<Record<string, number>>((acc, s) => {
    const key = s.city?.trim() || "(none)";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const byPlanInterest = signups.reduce<Record<string, number>>((acc, s) => {
    const key = s.plan_interest?.trim() || "(none)";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-zinc-50 font-sans">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-zinc-900">
          Job Proof Waitlist Admin
        </h1>
        <p className="mt-2 text-zinc-600">
          Total signups: <strong>{signups.length}</strong>
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-zinc-700">
              By trade
            </h2>
            <ul className="mt-2 space-y-1 text-sm text-zinc-600">
              {Object.entries(byTrade)
                .sort(([, a], [, b]) => b - a)
                .map(([trade, count]) => (
                  <li key={trade}>
                    {trade}: {count}
                  </li>
                ))}
              {Object.keys(byTrade).length === 0 && (
                <li className="text-zinc-400">No data</li>
              )}
            </ul>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-zinc-700">
              By city
            </h2>
            <ul className="mt-2 space-y-1 text-sm text-zinc-600">
              {Object.entries(byCity)
                .sort(([, a], [, b]) => b - a)
                .map(([city, count]) => (
                  <li key={city}>
                    {city}: {count}
                  </li>
                ))}
              {Object.keys(byCity).length === 0 && (
                <li className="text-zinc-400">No data</li>
              )}
            </ul>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-zinc-700">
              By plan interest
            </h2>
            <ul className="mt-2 space-y-1 text-sm text-zinc-600">
              {Object.entries(byPlanInterest)
                .sort(([, a], [, b]) => b - a)
                .map(([plan, count]) => (
                  <li key={plan}>
                    {plan}: {count}
                  </li>
                ))}
              {Object.keys(byPlanInterest).length === 0 && (
                <li className="text-zinc-400">No data</li>
              )}
            </ul>
          </section>
        </div>

        <div className="mt-8 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 font-medium text-zinc-700">created_at</th>
                <th className="px-4 py-3 font-medium text-zinc-700">email</th>
                <th className="px-4 py-3 font-medium text-zinc-700">trade</th>
                <th className="px-4 py-3 font-medium text-zinc-700">city</th>
                <th className="px-4 py-3 font-medium text-zinc-700">team_size</th>
                <th className="px-4 py-3 font-medium text-zinc-700">plan_interest</th>
                <th className="px-4 py-3 font-medium text-zinc-700">source</th>
                <th className="px-4 py-3 font-medium text-zinc-700">status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {signups.map((row, i) => (
                <tr key={row.email ?? i} className="bg-white hover:bg-zinc-50">
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                    {formatDate(row.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-900">
                    {row.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{row.trade ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-600">{row.city ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {row.team_size ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {row.plan_interest ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{row.source ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-600">{row.status ?? "—"}</td>
                </tr>
              ))}
              {signups.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-zinc-500"
                  >
                    No signups yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
