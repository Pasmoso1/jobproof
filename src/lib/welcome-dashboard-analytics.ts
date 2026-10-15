import { trackGa4Event } from "@/lib/ga4";

/**
 * Lightweight engagement events for the first-time / welcome dashboard.
 * Kept outside GA4_FUNNEL_EVENTS so the acquisition funnel stays unchanged.
 * Payloads are enums only — never email, phone, names or quote URLs.
 */
export const WELCOME_DASHBOARD_SOURCE = "welcome_dashboard";

export const WELCOME_DASHBOARD_EVENTS = {
  try_yourself_clicked: "welcome_try_yourself_clicked",
  sample_quote_clicked: "welcome_sample_quote_clicked",
  sample_job_clicked: "welcome_sample_job_clicked",
  profile_details_clicked: "welcome_profile_details_clicked",
} as const;

export type WelcomeDashboardEventName =
  (typeof WELCOME_DASHBOARD_EVENTS)[keyof typeof WELCOME_DASHBOARD_EVENTS];

export function trackWelcomeDashboardEvent(eventName: WelcomeDashboardEventName): boolean {
  return trackGa4Event(eventName, { source: WELCOME_DASHBOARD_SOURCE });
}
