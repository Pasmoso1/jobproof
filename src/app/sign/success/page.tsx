export default function ContractSignSuccessPage() {
  return (
    <div className="min-h-screen bg-zinc-50 py-12">
      <div className="mx-auto max-w-lg px-4">
        <div className="rounded-xl border border-green-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-lg font-medium text-green-900">
            Contract signed successfully. Thank you.
          </p>
          <p className="mt-3 text-sm text-zinc-600">
            Your acceptance has been recorded with a timestamp. You and the contractor will each
            receive a copy for your records.
          </p>
        </div>
      </div>
    </div>
  );
}
