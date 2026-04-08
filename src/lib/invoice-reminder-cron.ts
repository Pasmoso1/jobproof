import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  evaluateInvoiceAutomationEligibility,
  normalizeInvoiceReminderAutomationSettings,
  type InvoiceRowForAutomation,
  type ReminderSendRow,
} from "@/lib/invoice-reminder-automation";
import { sendInvoiceReminderEmail } from "@/lib/delivery-service";
import { buildInvoicePaymentBlocks } from "@/lib/invoice-payment-copy";
import { resolveContractorContactEmail } from "@/lib/contractor-contact-email";
import {
  formatDateEastern,
  formatLocalDateStringEastern,
} from "@/lib/datetime-eastern";
import { invoiceTaxShortLabel } from "@/lib/invoice-tax";
import { isBusinessProfileCompleteForApp } from "@/lib/validation/business-profile";

function formatProfileAddressLines(p: {
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
}): string[] {
  const street = [p.address_line_1, p.address_line_2].filter(Boolean).join(", ");
  const cityLine = [p.city, p.province, p.postal_code].filter(Boolean).join(", ");
  return [street, cityLine].filter((s) => s.trim().length > 0);
}

function formatJobServiceAddressLines(job: {
  property_address_line_1?: string | null;
  property_address_line_2?: string | null;
  property_city?: string | null;
  property_province?: string | null;
  property_postal_code?: string | null;
}): string[] {
  const street = [job.property_address_line_1, job.property_address_line_2]
    .filter(Boolean)
    .join(", ");
  const cityLine = [job.property_city, job.property_province, job.property_postal_code]
    .filter(Boolean)
    .join(", ");
  return [street, cityLine].filter((s) => s.trim().length > 0);
}

function unwrapCustomer(
  job: Record<string, unknown>
): {
  email?: string | null;
  full_name?: string | null;
  phone?: string | null;
} | null {
  const raw = job.customers;
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw as {
    email?: string | null;
    full_name?: string | null;
    phone?: string | null;
  };
}

export type InvoiceReminderAutomationRunResult = {
  profilesScanned: number;
  invoicesScanned: number;
  eligible: number;
  sent: number;
  failed: number;
  skipped: number;
};

/**
 * Batch automated invoice reminders. Intended for cron / scheduled jobs.
 * Uses the service role; requires `SUPABASE_SERVICE_ROLE_KEY` and Resend.
 */
export async function runInvoiceReminderAutomation(): Promise<InvoiceReminderAutomationRunResult> {
  const admin = createServiceRoleClient();
  const out: InvoiceReminderAutomationRunResult = {
    profilesScanned: 0,
    invoicesScanned: 0,
    eligible: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  if (!admin) {
    console.error("[runInvoiceReminderAutomation] Missing service role client");
    return out;
  }

  const { data: profiles, error: pErr } = await admin
    .from("profiles")
    .select(
      `
      id,
      user_id,
      business_name,
      contractor_name,
      phone,
      address_line_1,
      address_line_2,
      city,
      province,
      postal_code,
      default_contract_payment_terms,
      e_transfer_email,
      business_contact_email,
      invoice_reminders_enabled,
      invoice_reminders_automation_paused,
      invoice_remind_not_viewed_after_days,
      invoice_remind_viewed_after_days,
      invoice_remind_overdue_after_days,
      invoice_repeat_overdue_every_days
    `
    )
    .eq("invoice_reminders_enabled", true)
    .eq("invoice_reminders_automation_paused", false);

  if (pErr || !profiles?.length) {
    if (pErr) console.error("[runInvoiceReminderAutomation] profiles:", pErr.message);
    return out;
  }

  for (const profile of profiles) {
    out.profilesScanned += 1;
    const profileId = profile.id as string;
    const settings = normalizeInvoiceReminderAutomationSettings(profile);

    const { data: authUser } = await admin.auth.admin.getUserById(
      profile.user_id as string
    );
    const accountEmail = authUser?.user?.email?.trim() ?? "";
    if (
      !isBusinessProfileCompleteForApp({
        business_name: profile.business_name,
        account_email: accountEmail,
        phone: profile.phone,
        address_line_1: profile.address_line_1,
        city: profile.city,
        province: profile.province,
        postal_code: profile.postal_code,
      })
    ) {
      continue;
    }

    const { data: invRows, error: iErr } = await admin
      .from("invoices")
      .select(
        `
        id,
        job_id,
        profile_id,
        status,
        sent_at,
        viewed_at,
        due_date,
        balance_due,
        amount_paid_total,
        last_payment_at,
        total,
        deposit_credited,
        subtotal,
        tax_amount,
        invoice_number,
        notes,
        created_at,
        public_token
      `
      )
      .eq("profile_id", profileId)
      .in("status", ["sent", "overdue", "partially_paid"]);

    if (iErr || !invRows?.length) continue;

    const invoiceIds = invRows.map((r) => r.id as string);
    const { data: sendRows } = await admin
      .from("invoice_reminder_sends")
      .select("invoice_id, created_at, email_status")
      .in("invoice_id", invoiceIds);

    const sendsByInvoice = new Map<string, ReminderSendRow[]>();
    for (const s of sendRows ?? []) {
      const id = s.invoice_id as string;
      const list = sendsByInvoice.get(id) ?? [];
      list.push({
        created_at: String(s.created_at),
        email_status: String(s.email_status),
      });
      sendsByInvoice.set(id, list);
    }

    const jobIds = [...new Set(invRows.map((r) => String(r.job_id)))];
    const { data: jobs } = await admin
      .from("jobs")
      .select(
        `
        id,
        title,
        property_province,
        property_address_line_1,
        property_address_line_2,
        property_city,
        property_postal_code,
        customers (
          email,
          full_name,
          phone
        )
      `
      )
      .in("id", jobIds);

    const jobById = new Map<string, Record<string, unknown>>();
    for (const j of jobs ?? []) {
      jobById.set(String(j.id), j as Record<string, unknown>);
    }

    const { resolvePublicAppOrigin } = await import("@/lib/app-origin");

    for (const row of invRows) {
      out.invoicesScanned += 1;
      const inv = row as unknown as InvoiceRowForAutomation & {
        job_id: string;
        subtotal: number;
        tax_amount: number;
        invoice_number: string | null;
        notes: string | null;
        created_at: string;
        public_token: string | null;
      };

      const decision = evaluateInvoiceAutomationEligibility({
        invoice: inv,
        settings,
        reminderSends: sendsByInvoice.get(inv.id) ?? [],
      });

      if (!decision.eligible) {
        out.skipped += 1;
        continue;
      }
      out.eligible += 1;

      const job = jobById.get(String(inv.job_id));
      if (!job) {
        out.skipped += 1;
        continue;
      }

      const customerRow = unwrapCustomer(job);
      const customerEmail = customerRow?.email?.trim() ?? "";
      if (!customerEmail) {
        out.skipped += 1;
        continue;
      }

      const publicToken = inv.public_token?.trim();
      const publicInvoiceUrl = publicToken
        ? `${resolvePublicAppOrigin()}/invoice/${publicToken}`
        : null;
      if (!publicInvoiceUrl) {
        out.skipped += 1;
        continue;
      }

      const province =
        (job.property_province as string | null | undefined) ?? null;
      const taxRateLabel = invoiceTaxShortLabel(province);
      const subtotal = Number(inv.subtotal);
      const taxAmount = Number(inv.tax_amount);
      const total = Number(inv.total);
      const depositCredited = Number(inv.deposit_credited ?? 0);
      const balanceDue = Number(inv.balance_due ?? Math.max(0, total - depositCredited));

      const invoiceNumberDisplay =
        inv.invoice_number?.trim() || `Invoice ${String(inv.id).slice(0, 8)}`;
      const dueRaw = inv.due_date?.trim() || null;
      const dueDateFormatted = dueRaw
        ? formatLocalDateStringEastern(dueRaw)
        : "Not specified";
      const issueDateFormatted = formatDateEastern(String(inv.created_at));
      const notesTrimmed =
        typeof inv.notes === "string" ? inv.notes.trim() || null : null;

      const bizName = (profile.business_name as string | null)?.trim() || "Your contractor";
      const contractorContactEmail = resolveContractorContactEmail(
        { business_contact_email: profile.business_contact_email as string | null },
        accountEmail || null
      );
      const { paymentInstructions, paymentContactLines } = buildInvoicePaymentBlocks(
        profile as Parameters<typeof buildInvoicePaymentBlocks>[0],
        bizName,
        contractorContactEmail
      );

      const customerName = customerRow?.full_name?.trim() ?? "there";
      const contractorAddressLines = formatProfileAddressLines(
        profile as Parameters<typeof formatProfileAddressLines>[0]
      );
      const serviceAddressLines = formatJobServiceAddressLines(
        job as Parameters<typeof formatJobServiceAddressLines>[0]
      );

      const sendResult = await sendInvoiceReminderEmail({
        toEmail: customerEmail,
        toName: customerName,
        jobTitle: String(job.title ?? "Job"),
        businessDisplayName: profile.business_name as string | null,
        replyToEmail: contractorContactEmail ?? (accountEmail || null),
        publicInvoiceUrl,
        reminderKind: decision.reminderKind,
        reminderTone: decision.reminderTone,
        customerFacingMode: "safe_automation",
        contractor: {
          businessName: bizName,
          contactName: (profile.contractor_name as string | null)?.trim() || null,
          phone: (profile.phone as string | null)?.trim() || null,
          email: contractorContactEmail,
          addressLines: contractorAddressLines,
        },
        customer: {
          name: customerName,
          email: customerRow?.email?.trim() || null,
          phone: customerRow?.phone?.trim() || null,
          serviceAddressLines,
        },
        invoiceNumber: invoiceNumberDisplay,
        issueDate: issueDateFormatted,
        dueDate: dueDateFormatted,
        subtotal,
        taxAmount,
        taxRateLabel,
        total,
        depositReceived: depositCredited,
        balanceDue,
        paymentInstructions,
        paymentContactLines,
        notes: notesTrimmed,
        deliveryLog: {
          profileId,
          type: "invoice",
          relatedEntityId: String(inv.id),
          useServiceRoleLog: true,
        },
      });

      const { error: logErr } = await admin.from("invoice_reminder_sends").insert({
        invoice_id: inv.id,
        profile_id: profileId,
        source: "automation",
        reminder_kind: decision.reminderKind,
        email_status: sendResult.success ? "success" : "failed",
        error_message: sendResult.success ? null : sendResult.error ?? "unknown",
      });

      if (logErr) {
        console.error("[runInvoiceReminderAutomation] log insert:", logErr.message);
      }

      if (sendResult.success) out.sent += 1;
      else out.failed += 1;
    }
  }

  return out;
}
