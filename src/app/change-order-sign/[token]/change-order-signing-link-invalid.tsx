import Link from "next/link";

const NO_LONGER_VALID =
  "This signing link is no longer valid. Please contact the contractor for an updated change order.";

export function ChangeOrderSigningLinkInvalid({
  outcome,
}: {
  outcome: "invalid" | "withdrawn" | "expired" | "used";
}) {
  const title = outcome === "used" ? "Already signed" : "Signing unavailable";

  const body =
    outcome === "used"
      ? "This change order has already been signed. If you need a copy, ask your contractor."
      : NO_LONGER_VALID;

  return (
    <div className="min-h-screen bg-zinc-50 py-12">
      <div className="mx-auto max-w-lg px-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-semibold text-zinc-900">{title}</h1>
          <p className="mt-3 text-sm text-zinc-700">{body}</p>
          <p className="mt-6 text-xs text-zinc-500">
            If you believe this is a mistake, reach out to the contractor who sent you this link.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block text-sm font-medium text-[#2436BB] hover:underline"
          >
            Go to JobProof home
          </Link>
        </div>
      </div>
    </div>
  );
}
