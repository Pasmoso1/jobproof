import type {
  InvoiceReminderKind,
  InvoiceReminderTone,
} from "@/lib/delivery-service";
import {
  diffCalendarDaysYmd,
  getTodayYmdEastern,
  isoToYmdEastern,
} from "@/lib/datetime-eastern";

export const INVOICE_AUTOMATION_MIN_HOURS_BETWEEN_REMINDERS = 24;
export const CUSTOMER_MAY_HAVE_PAID_VIEWED_RECENT_HOURS = 48;

export type InvoiceReminderAutomationSettings = {
  reminders_enabled: boolean;
  automation_paused: boolean;
  remind_not_viewed_after_days: number;
  remind_viewed_after_days: number;
  remind_overdue_after_days: number;
  repeat_overdue_every_days: number;
};

export const DEFAULT_INVOICE_REMINDER_AUTOMATION_SETTINGS: InvoiceReminderAutomationSettings =
  {
    reminders_enabled: false,
    automation_paused: false,
    remind_not_viewed_after_days: 3,
    remind_viewed_after_days: 5,
    remind_overdue_after_days: 2,
    repeat_overdue_every_days: 7,
  };

export function normalizeInvoiceReminderAutomationSettings(
  row: Record<string, unknown> | null | undefined
): InvoiceReminderAutomationSettings {
  if (!row) return { ...DEFAULT_INVOICE_REMINDER_AUTOMATION_SETTINGS };
  const num = (v: unknown, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const clampDay = (n: number) => Math.min(365, Math.max(1, Math.round(n)));
  return {
    reminders_enabled: Boolean(row.invoice_reminders_enabled),
    automation_paused: Boolean(row.invoice_reminders_automation_paused),
    remind_not_viewed_after_days: clampDay(
      num(row.invoice_remind_not_viewed_after_days, 3)
    ),
    remind_viewed_after_days: clampDay(
      num(row.invoice_remind_viewed_after_days, 5)
    ),
    remind_overdue_after_days: clampDay(
      num(row.invoice_remind_overdue_after_days, 2)
    ),
    repeat_overdue_every_days: clampDay(
      num(row.invoice_repeat_overdue_every_days, 7)
    ),
  };
}

export type InvoiceRowForAutomation = {
  id: string;
  status: string;
  sent_at: string | null;
  viewed_at: string | null;
  due_date: string | null;
  balance_due: number | null;
  amount_paid_total: number | null;
  last_payment_at: string | null;
  total: number;
  deposit_credited: number | null;
};

export type ReminderSendRow = {
  created_at: string;
  email_status: string;
};

const BAL_EPS = 0.01;

function invoiceBalanceDue(inv: InvoiceRowForAutomation): number {
  const total = Number(inv.total);
  const dep = Number(inv.deposit_credited ?? 0);
  const fallback = Math.max(0, total - dep);
  if (inv.balance_due != null && inv.balance_due !== undefined) {
    return Math.max(0, Number(inv.balance_due));
  }
  return fallback;
}

function lastSuccessfulReminderAt(sends: ReminderSendRow[]): string | null {
  const ok = sends
    .filter((s) => s.email_status === "success")
    .map((s) => s.created_at)
    .sort((a, b) => b.localeCompare(a));
  return ok[0] ?? null;
}

function hoursSince(iso: string | null, nowMs: number): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return (nowMs - t) / 3600000;
}

function isCalendarOverdue(dueYmd: string | null | undefined, todayYmd: string): boolean {
  const d = dueYmd?.trim();
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return d < todayYmd;
}

/**
 * Contractor-facing: invoice viewed on public page recently, no payment recorded, balance remains.
 * Rule: viewed_at within last 48h, balance > 0, amount_paid_total ≈ 0 (contractor has not recorded payments).
 */
export function shouldShowCustomerMayHavePaidWarning(opts: {
  viewed_at: string | null | undefined;
  balance_due: number | null | undefined;
  amount_paid_total: number | null | undefined;
  /** Optional statuses — only when invoice is out for payment */
  status: string | null | undefined;
  nowMs?: number;
}): boolean {
  const st = opts.status ?? "";
  if (
    st !== "sent" &&
    st !== "overdue" &&
    st !== "partially_paid"
  ) {
    return false;
  }
  const v = opts.viewed_at?.trim();
  if (!v) return false;
  const bal =
    opts.balance_due != null && opts.balance_due !== undefined
      ? Number(opts.balance_due)
      : null;
  if (bal == null || !Number.isFinite(bal) || bal <= BAL_EPS) return false;
  const paid = Number(opts.amount_paid_total ?? 0);
  if (!Number.isFinite(paid) || paid > BAL_EPS) return false;
  const viewedMs = new Date(v).getTime();
  if (Number.isNaN(viewedMs)) return false;
  const now = opts.nowMs ?? Date.now();
  const ageH = (now - viewedMs) / 3600000;
  if (ageH < 0) return false;
  return ageH <= CUSTOMER_MAY_HAVE_PAID_VIEWED_RECENT_HOURS;
}

export type AutomationEligibilityResult =
  | { eligible: false; reason: string }
  | {
      eligible: true;
      reminderKind: InvoiceReminderKind;
      reminderTone: InvoiceReminderTone;
    };

export function evaluateInvoiceAutomationEligibility(input: {
  invoice: InvoiceRowForAutomation;
  settings: InvoiceReminderAutomationSettings;
  reminderSends: ReminderSendRow[];
  now?: Date;
}): AutomationEligibilityResult {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const todayYmd = getTodayYmdEastern(now);
  const inv = input.invoice;
  const s = String(inv.status ?? "");

  if (s === "draft" || s === "paid") {
    return { eligible: false, reason: "status_excluded" };
  }
  if (s !== "sent" && s !== "overdue" && s !== "partially_paid") {
    return { eligible: false, reason: "status_excluded" };
  }

  const balance = invoiceBalanceDue(inv);
  if (balance <= BAL_EPS) {
    return { eligible: false, reason: "no_balance" };
  }

  const lastOk = lastSuccessfulReminderAt(input.reminderSends);
  const hSince = hoursSince(lastOk, nowMs);
  if (lastOk && hSince < INVOICE_AUTOMATION_MIN_HOURS_BETWEEN_REMINDERS) {
    return { eligible: false, reason: "cooldown" };
  }

  const sentAt = inv.sent_at?.trim();
  if (!sentAt) {
    return { eligible: false, reason: "never_sent" };
  }

  const overdue = isCalendarOverdue(inv.due_date, todayYmd);
  const dueYmd = inv.due_date?.trim() ?? "";
  const daysPastDue =
    overdue && /^\d{4}-\d{2}-\d{2}$/.test(dueYmd)
      ? diffCalendarDaysYmd(dueYmd, todayYmd)
      : 0;

  const hasViewed = Boolean(inv.viewed_at?.trim());
  const sentYmd = isoToYmdEastern(sentAt);
  const daysSinceSent = diffCalendarDaysYmd(sentYmd, todayYmd);
  const viewedYmd = hasViewed ? isoToYmdEastern(inv.viewed_at!) : "";
  const daysSinceViewed =
    hasViewed && viewedYmd
      ? diffCalendarDaysYmd(viewedYmd, todayYmd)
      : 0;

  const lastPay = inv.last_payment_at?.trim();
  const lastPayYmd = lastPay ? isoToYmdEastern(lastPay) : "";
  const daysSinceLastPayment =
    lastPayYmd && /^\d{4}-\d{2}-\d{2}$/.test(lastPayYmd)
      ? diffCalendarDaysYmd(lastPayYmd, todayYmd)
      : null;

  if (overdue) {
    const hadAnySuccess = input.reminderSends.some((x) => x.email_status === "success");
    if (!hadAnySuccess) {
      if (daysPastDue >= input.settings.remind_overdue_after_days) {
        const tone: InvoiceReminderTone = hasViewed ? "firm" : "soft";
        if (s === "partially_paid") {
          return {
            eligible: true,
            reminderKind: "partial_balance",
            reminderTone: tone,
          };
        }
        return { eligible: true, reminderKind: "overdue", reminderTone: tone };
      }
      return { eligible: false, reason: "overdue_not_ready" };
    }
    const lastYmd = lastOk ? isoToYmdEastern(lastOk) : "";
    const daysSinceLastReminder =
      lastYmd && /^\d{4}-\d{2}-\d{2}$/.test(lastYmd)
        ? diffCalendarDaysYmd(lastYmd, todayYmd)
        : 0;
    if (daysSinceLastReminder >= input.settings.repeat_overdue_every_days) {
      const tone: InvoiceReminderTone = hasViewed ? "firm" : "soft";
      if (s === "partially_paid") {
        return {
          eligible: true,
          reminderKind: "partial_balance",
          reminderTone: tone,
        };
      }
      return { eligible: true, reminderKind: "overdue", reminderTone: tone };
    }
    return { eligible: false, reason: "overdue_repeat_not_ready" };
  }

  if (s === "partially_paid") {
    const anchorDays =
      daysSinceLastPayment != null
        ? daysSinceLastPayment
        : daysSinceSent;
    const need = input.settings.remind_viewed_after_days;
    if (anchorDays >= need) {
      return {
        eligible: true,
        reminderKind: "partial_balance",
        reminderTone: hasViewed ? "firm" : "soft",
      };
    }
    return { eligible: false, reason: "partial_not_ready" };
  }

  if (!hasViewed) {
    if (daysSinceSent >= input.settings.remind_not_viewed_after_days) {
      return { eligible: true, reminderKind: "standard", reminderTone: "soft" };
    }
    return { eligible: false, reason: "not_viewed_not_ready" };
  }

  if (daysSinceViewed >= input.settings.remind_viewed_after_days) {
    return { eligible: true, reminderKind: "standard", reminderTone: "firm" };
  }
  return { eligible: false, reason: "viewed_not_ready" };
}
