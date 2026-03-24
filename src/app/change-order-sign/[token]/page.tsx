import { resolveChangeOrderSigningPage } from "@/app/(app)/actions";
import { ChangeOrderRemoteSigningForm } from "./change-order-remote-signing-form";
import { ChangeOrderSigningLinkInvalid } from "./change-order-signing-link-invalid";

export default async function ChangeOrderRemoteSigningPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const res = await resolveChangeOrderSigningPage(token);

  if (res.outcome !== "ok") {
    return <ChangeOrderSigningLinkInvalid outcome={res.outcome} />;
  }

  const d = res.data;
  if (!d.change_order_id || !d.job_id) {
    return <ChangeOrderSigningLinkInvalid outcome="invalid" />;
  }

  const original = d.original_contract_price ?? 0;
  const change = d.change_amount ?? 0;
  const revised = d.revised_total_price ?? original + change;

  return (
    <div className="min-h-screen bg-zinc-50 py-12">
      <div className="mx-auto max-w-2xl px-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-zinc-900">
            Sign change order: {d.change_title ?? "Change order"}
          </h1>
          <p className="mt-1 text-zinc-600">Job: {d.job_title}</p>
          <p className="mt-4 text-sm text-zinc-500">
            Please review the change order below and sign to approve the amendment.
          </p>

          <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <h2 className="font-medium text-zinc-900">{d.change_title ?? "Change order"}</h2>
            {d.change_description && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">
                {d.change_description}
              </p>
            )}
            {d.reason_for_change && (
              <p className="mt-2 text-sm">
                <span className="font-medium text-zinc-600">Reason:</span> {d.reason_for_change}
              </p>
            )}
            <div className="mt-4 space-y-2 border-t border-zinc-200 pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-600">Previous job total</span>
                <span className="font-medium text-zinc-900">${original.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-600">New job total</span>
                <span className="font-semibold text-[#2436BB]">${revised.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-sm">
                <span className="text-zinc-600">Change</span>
                <span className={`font-medium ${change >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {change >= 0 ? "+" : ""}${change.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <ChangeOrderRemoteSigningForm token={token} />
        </div>
      </div>
    </div>
  );
}
