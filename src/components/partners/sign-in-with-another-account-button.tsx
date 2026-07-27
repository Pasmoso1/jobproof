"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PARTNER_STATUS_LOGIN_HREF } from "@/lib/partners/partner-status-view";

export function SignInWithAnotherAccountButton({
  className,
}: {
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    try {
      const supabase = createClient();
      // Clear local + server session so login cannot silently reuse this account.
      await supabase.auth.signOut({ scope: "global" }).catch(async () => {
        await supabase.auth.signOut();
      });
      router.replace(PARTNER_STATUS_LOGIN_HREF);
      router.refresh();
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={className}
    >
      {loading ? "Signing out…" : "Sign in with another account"}
    </button>
  );
}
