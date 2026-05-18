export type JobProtectionChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

export type JobProtectionChecklistInput = {
  customerEmail?: string | null;
  customerPhone?: string | null;
  contractStatus?: string | null;
  updateCount: number;
  changeOrders: { status: string }[];
  hasSentOrPaidInvoice: boolean;
  hasPaymentRecorded: boolean;
};

export type JobProtectionChecklistResult = {
  items: JobProtectionChecklistItem[];
  completedCount: number;
  totalCount: number;
  percent: number;
};

/**
 * Simple product guidance score (not legal advice). Uses data already loaded on the job page.
 */
export function computeJobProtectionChecklist(
  input: JobProtectionChecklistInput
): JobProtectionChecklistResult {
  const hasContact = Boolean(
    String(input.customerEmail ?? "").trim() || String(input.customerPhone ?? "").trim()
  );

  const items: JobProtectionChecklistItem[] = [
    { id: "created", label: "Job created", done: true },
    { id: "contact", label: "Customer contact saved", done: hasContact },
    {
      id: "contract",
      label: "Contract signed",
      done: input.contractStatus === "signed",
    },
    {
      id: "proof",
      label: "Proof photos or updates added",
      done: input.updateCount > 0,
    },
  ];

  if (input.changeOrders.length > 0) {
    const anySigned = input.changeOrders.some((c) => c.status === "signed");
    items.push({
      id: "change_orders",
      label: "Change orders approved",
      done: anySigned,
    });
  }

  items.push({
    id: "invoice",
    label: "Invoice sent",
    done: input.hasSentOrPaidInvoice,
  });

  items.push({
    id: "payment",
    label: "Payment recorded",
    done: input.hasPaymentRecorded,
  });

  const completedCount = items.filter((i) => i.done).length;
  const totalCount = items.length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return { items, completedCount, totalCount, percent };
}
