"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function LogoutButton({
  className = "text-sm font-medium text-zinc-600 hover:text-zinc-900",
}: {
  className?: string;
}) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={className}
    >
      Log out
    </button>
  );
}
