/** UI labels for change order delivery / status */

export function formatChangeOrderSentDelivery(
  method: string | null | undefined
): string {
  if (method === "email") return "Email";
  if (method === "device") return "On this device";
  return "—";
}
