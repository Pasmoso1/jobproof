import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SupportContactForm } from "./contact-form";

export const dynamic = "force-dynamic";

export default async function SupportContactPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("contractor_name, business_name, business_contact_email")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const defaultName =
    String(profile?.contractor_name ?? "").trim() ||
    String(profile?.business_name ?? "").trim() ||
    "";
  const defaultEmail =
    String(profile?.business_contact_email ?? "").trim() || String(user?.email ?? "").trim();

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <Link href="/support" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
          ← Support
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-zinc-900">Contact Support</h1>
        <p className="mt-2 text-zinc-600">
          Tell us what you need help with. We store your message securely and review it regularly.
        </p>
      </div>
      <SupportContactForm defaultName={defaultName} defaultEmail={defaultEmail} />
    </div>
  );
}
