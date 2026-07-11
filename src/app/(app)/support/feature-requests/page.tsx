import Link from "next/link";
import { FeatureRequestForm } from "./feature-request-form";

export const dynamic = "force-dynamic";

export default function FeatureRequestsPage() {
  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <Link href="/support" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
          ← Support
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-zinc-900">Feature Requests</h1>
        <p className="mt-2 text-zinc-600">
          Share ideas that would help your contracting business. Voting will be added later—for now,
          every submission is saved and reviewed.
        </p>
      </div>
      <FeatureRequestForm />
    </div>
  );
}
