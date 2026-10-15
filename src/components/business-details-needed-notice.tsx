import Link from "next/link";
import {
  MISSING_BUSINESS_DETAIL_LABELS,
  type MissingBusinessDetail,
} from "@/lib/validation/business-profile";

export function buildBusinessDetailsHref(returnTo: string): string {
  return `/settings/business?returnTo=${encodeURIComponent(returnTo)}`;
}

function formatMissing(missing: MissingBusinessDetail[]): string {
  const labels = missing.map((m) => MISSING_BUSINESS_DETAIL_LABELS[m].toLowerCase());
  if (labels.length <= 1) return labels[0] ?? "business details";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/** Just-in-time prompt shown where formal customer documents are created. */
export function BusinessDetailsNeededNotice({
  missing,
  returnTo,
  action,
}: {
  missing: MissingBusinessDetail[];
  returnTo: string;
  /** e.g. "send contracts and invoices" */
  action: string;
}) {
  if (missing.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="font-medium">
        Add your {formatMissing(missing)} to {action}.
      </p>
      <p className="mt-1 text-amber-900">
        These details appear on the documents your customers receive.
      </p>
      <Link
        href={buildBusinessDetailsHref(returnTo)}
        className="mt-2 inline-flex min-h-11 items-center font-semibold text-[#2436BB] underline-offset-2 hover:underline"
      >
        Add business details →
      </Link>
    </div>
  );
}
