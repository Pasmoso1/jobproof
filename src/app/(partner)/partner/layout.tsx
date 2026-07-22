import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Shared auth gate for Partner Portal + application status. */
export default async function PartnerSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/partner");
  }

  return children;
}
