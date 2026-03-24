import Link from "next/link";
import { notFound } from "next/navigation";
import { getJob, getChangeOrder } from "@/app/(app)/actions";
import { ChangeOrderDeviceSigningForm } from "./change-order-device-signing-form";

export default async function ChangeOrderDeviceSigningPage({
  params,
}: {
  params: Promise<{ jobId: string; changeOrderId: string }>;
}) {
  const { jobId, changeOrderId } = await params;
  const [job, changeOrder] = await Promise.all([
    getJob(jobId),
    getChangeOrder(changeOrderId),
  ]);

  if (!job || !changeOrder) notFound();
  if (changeOrder.job_id !== jobId) notFound();
  if (changeOrder.status !== "sent") {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-zinc-900">Change order</h1>
        <p className="mt-2 text-zinc-600">
          {changeOrder.status === "signed"
            ? "This change order has already been signed."
            : "This change order is not ready for signing."}
        </p>
        <Link
          href={`/jobs/${jobId}/change-orders`}
          className="mt-4 inline-block font-medium text-[#2436BB] hover:underline"
        >
          Back to change orders
        </Link>
      </div>
    );
  }

  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href={`/jobs/${jobId}/change-orders`}
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          ← Back to change orders
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">Customer signs change order</h1>
        <p className="mt-1 text-zinc-600">
          Have {customer?.full_name ?? "the customer"} sign this change order on your device
        </p>
      </div>

      <ChangeOrderDeviceSigningForm
        changeOrderId={changeOrderId}
        jobId={jobId}
        changeOrder={changeOrder}
      />
    </div>
  );
}
