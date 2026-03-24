"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export function DashboardAlerts() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [onboarded, setOnboarded] = useState(false);

  useEffect(() => {
    if (searchParams.get("confirmed") === "true") {
      setConfirmed(true);
      router.replace("/dashboard", { scroll: false });
    }
    if (searchParams.get("onboarded") === "true") {
      setOnboarded(true);
      router.replace("/dashboard", { scroll: false });
    }
  }, [searchParams, router]);

  if (!confirmed && !onboarded) return null;

  return (
    <div className="space-y-3">
      {confirmed && (
        <div
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          role="status"
        >
          Your email has been confirmed. Your account is ready to use.
        </div>
      )}
      {onboarded && (
        <div
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          role="status"
        >
          Welcome to JobProof. Your business profile is set up and you&apos;re ready to create your first job.
        </div>
      )}
    </div>
  );
}
