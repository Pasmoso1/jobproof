const COPY = {
  photos: {
    title: "Upload proof photos",
    body: "Every photo and update helps build a timestamped record of the job.",
  },
  contract: {
    title: "Send agreement for signature",
    body: "Signed terms help prevent misunderstandings before work starts.",
  },
  change_order: {
    title: "Capture approval before extra work begins",
    body: "Approved changes protect your time, materials, and payment.",
  },
  invoice: {
    title: "Send invoice tied to your proof timeline",
    body: "Customers can see what was agreed, completed, and billed.",
  },
} as const;

export type ProtectionMicrocopyVariant = keyof typeof COPY;

export function ProtectionMicrocopy({
  variant,
  className = "",
}: {
  variant: ProtectionMicrocopyVariant;
  className?: string;
}) {
  const { title, body } = COPY[variant];
  return (
    <p className={`text-xs leading-snug text-zinc-500 ${className}`.trim()}>
      <span className="font-medium text-zinc-700">{title}.</span> {body}
    </p>
  );
}
