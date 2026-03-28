/** User-facing job row status: unsigned “active” jobs are not shown as Active. */
export function getJobListStatusDisplay(job: {
  status: string;
  contract_status?: string | null;
}): {
  label: string;
  badgeClass: string;
} {
  if (job.status === "completed") {
    return {
      label: "Completed",
      badgeClass: "bg-zinc-100 text-zinc-700",
    };
  }
  if (job.status === "cancelled") {
    return {
      label: "Cancelled",
      badgeClass: "bg-red-100 text-red-800",
    };
  }
  if (job.status === "active") {
    if (job.contract_status === "signed") {
      return {
        label: "Active",
        badgeClass: "bg-green-100 text-green-800",
      };
    }
    return {
      label: "Awaiting signed contract",
      badgeClass: "bg-amber-100 text-amber-900",
    };
  }
  return {
    label: job.status,
    badgeClass: "bg-zinc-100 text-zinc-700",
  };
}
