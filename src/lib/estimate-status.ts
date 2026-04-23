import { getTodayYmdEastern } from "@/lib/datetime-eastern";

export type EstimateDbStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "declined";

export type EstimateDisplayStatus = EstimateDbStatus | "expired";

export function deriveEstimateDisplayStatus(
  status: string,
  expiryYmd: string | null | undefined,
  todayYmdEastern: string = getTodayYmdEastern()
): EstimateDisplayStatus {
  const s = status as EstimateDbStatus;
  if (s === "accepted" || s === "declined" || s === "draft") return s;
  const exp = (expiryYmd ?? "").trim();
  if (exp && /^\d{4}-\d{2}-\d{2}$/.test(exp) && exp < todayYmdEastern) {
    return "expired";
  }
  if (s === "sent" || s === "viewed") return s;
  return "draft";
}

/** Accept / decline allowed when estimate was sent (or viewed) and not past expiry (Eastern calendar). */
export function isEstimateOpenForCustomerResponse(
  status: string,
  expiryYmd: string | null | undefined,
  todayYmdEastern: string = getTodayYmdEastern()
): boolean {
  const s = status as EstimateDbStatus;
  if (s !== "sent" && s !== "viewed") return false;
  const exp = (expiryYmd ?? "").trim();
  if (exp && /^\d{4}-\d{2}-\d{2}$/.test(exp) && exp < todayYmdEastern) return false;
  return true;
}
