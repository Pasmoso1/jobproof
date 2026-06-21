"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

function readDashboardFlashFromLocation(): { confirmed: boolean; onboarded: boolean } {
  if (typeof window === "undefined") {
    return { confirmed: false, onboarded: false };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    confirmed: params.get("confirmed") === "true",
    onboarded: params.get("onboarded") === "true",
  };
}

export function DashboardAlerts() {
  const router = useRouter();
  const [flash] = useState(readDashboardFlashFromLocation);

  useEffect(() => {
    if (flash.confirmed || flash.onboarded) {
      router.replace("/dashboard", { scroll: false });
    }
  }, [flash.confirmed, flash.onboarded, router]);

  if (!flash.confirmed && !flash.onboarded) return null;

  return (
    <div className="space-y-3">
      {flash.confirmed && (
        <div
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          role="status"
        >
          Your email has been confirmed. Your account is ready to use.
        </div>
      )}
      {flash.onboarded && (
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
