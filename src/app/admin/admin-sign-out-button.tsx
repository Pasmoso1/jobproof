"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_CLASS_NAME =
  "inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2 disabled:opacity-60";

type AdminSignOutButtonProps = {
  /** Visible button label. */
  label?: string;
  /** Label while the sign-out request is in flight. */
  busyLabel?: string;
  /** Post-logout destination. Default `/login` — never bounce back into admin. */
  redirectTo?: string;
  className?: string;
};

/**
 * Global Supabase Auth sign-out for admin surfaces.
 * Ends the JobProof session (admin, contractor, and Partner) alike.
 */
export function AdminSignOutButton({
  label = "Sign out",
  busyLabel = "Signing out…",
  redirectTo = "/login",
  className = DEFAULT_CLASS_NAME,
}: AdminSignOutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void handleSignOut()}
      disabled={loading}
      className={className}
    >
      {loading ? busyLabel : label}
    </button>
  );
}
