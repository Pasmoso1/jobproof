export function QuoteRequestUrgentListBadge({ isUrgent }: { isUrgent: boolean }) {
  if (isUrgent) {
    return (
      <span className="inline-flex rounded-full bg-red-600 px-2 py-1 text-xs font-semibold text-white">
        🚨 Urgent
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
      Normal
    </span>
  );
}

export function QuoteRequestUrgentDetailBadge({ isUrgent }: { isUrgent: boolean }) {
  if (isUrgent) {
    return (
      <span className="inline-flex rounded-lg border border-red-300 bg-red-100 px-2.5 py-1 text-sm font-semibold text-red-700">
        🚨 Urgent Request
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-lg bg-zinc-100 px-2.5 py-1 text-sm font-medium text-zinc-700">
      Normal Priority
    </span>
  );
}

export function QuoteRequestNewUrgentBanner({
  isNew,
  isUrgent,
}: {
  isNew: boolean;
  isUrgent: boolean;
}) {
  if (!isNew || !isUrgent) return null;

  return (
    <div
      className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
      role="status"
    >
      <p className="font-semibold">🚨 Urgent quote request</p>
      <p className="mt-1 text-red-800">
        This homeowner marked the request as urgent and may contact you directly by phone.
      </p>
    </div>
  );
}
