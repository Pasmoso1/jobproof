import Link from "next/link";

type UpdateRow = {
  id: string;
  category: string;
  title: string;
  created_at: string;
  location_source?: string | null;
  location_latitude?: number | null;
  location_longitude?: number | null;
  job_update_attachments: { id: string; file_type?: string | null }[];
};

export function RecentJobUpdatesPanel({
  jobId,
  updates,
}: {
  jobId: string;
  updates: UpdateRow[];
}) {
  const recent = updates.slice(0, 8);
  if (recent.length === 0) return null;

  return (
    <section className="mt-10 rounded-xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-4 py-3 sm:px-6">
        <h2 className="font-semibold text-zinc-900">Recent updates on this job</h2>
        <p className="mt-0.5 text-sm text-zinc-600">
          Saved updates and attachments show on the job timeline. Add another above anytime.
        </p>
      </div>
      <ul className="divide-y divide-zinc-100">
        {recent.map((u) => {
          const n = u.job_update_attachments?.length ?? 0;
          const photoCount =
            u.job_update_attachments?.filter((a) => a.file_type === "photo").length ?? 0;
          const hasLoc =
            u.location_source === "device_current" &&
            u.location_latitude != null &&
            u.location_longitude != null;
          return (
            <li key={u.id} className="px-4 py-3 sm:px-6">
              <p className="text-sm font-medium text-zinc-900">{u.title}</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                <span className="capitalize">{u.category}</span>
                {" • "}
                {new Date(u.created_at).toLocaleString()}
                {n > 0 && (
                  <>
                    {" • "}
                    {n} attachment{n === 1 ? "" : "s"}
                    {photoCount > 0 && (
                      <>
                        {" "}
                        ({photoCount} photo{photoCount === 1 ? "" : "s"})
                      </>
                    )}
                  </>
                )}
              </p>
              {hasLoc && photoCount > 0 && (
                <p className="mt-1 text-xs font-medium text-zinc-700">Location recorded</p>
              )}
            </li>
          );
        })}
      </ul>
      <div className="border-t border-zinc-100 px-4 py-3 sm:px-6">
        <Link
          href={`/jobs/${jobId}`}
          className="text-sm font-medium text-[#2436BB] hover:underline"
        >
          View full timeline on job →
        </Link>
      </div>
    </section>
  );
}
