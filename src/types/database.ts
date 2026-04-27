export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PlanType = "solo" | "team" | "enterprise";
export type SubscriptionStatus = "trial" | "active" | "cancelled" | "past_due";
export type JobStatus = "active" | "completed" | "cancelled";
export type UpdateCategory = "before" | "progress" | "materials" | "issue" | "completion" | "other";
export type JobContractStatus = "none" | "draft" | "pending" | "signed" | "void";
export type InvoiceStatus =
  | "none"
  | "draft"
  | "sent"
  | "paid"
  | "overdue"
  | "partially_paid";

export interface Profile {
  id: string;
  user_id: string;
  plan_type: PlanType;
  subscription_status: SubscriptionStatus;
  active_job_limit: number;
  storage_limit_mb: number;
  business_name: string | null;
  contractor_name: string | null;
  /** Shown on invoices / PDFs / public invoice; app falls back to auth email when null */
  business_contact_email?: string | null;
  /** Interac e-Transfer receiving address for invoices */
  e_transfer_email?: string | null;
  /** When true, scheduled/cron jobs may send automated invoice reminders. */
  invoice_reminders_enabled?: boolean;
  /** Pauses automation while keeping settings (default false). */
  invoice_reminders_automation_paused?: boolean;
  invoice_remind_not_viewed_after_days?: number;
  invoice_remind_viewed_after_days?: number;
  invoice_remind_overdue_after_days?: number;
  invoice_repeat_overdue_every_days?: number;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  /** Optional: pre-filled on new contract drafts (after migration 011) */
  default_contract_payment_terms?: string | null;
  default_contract_terms_and_conditions?: string | null;
  default_contract_warranty_note?: string | null;
  default_contract_cancellation_note?: string | null;
  /** First-touch acquisition metadata captured before account creation. */
  signup_utm_source?: string | null;
  signup_utm_medium?: string | null;
  signup_utm_campaign?: string | null;
  signup_utm_content?: string | null;
  signup_utm_term?: string | null;
  signup_referrer?: string | null;
  signup_landing_page?: string | null;
  signup_first_seen_at?: string | null;
  /** Optional self-reported channel from signup/early-access forms. */
  heard_about_source?: string | null;
  created_at: string;
  updated_at: string;
}

/** Row from `email_logs` — transactional email audit trail */
export interface EmailLog {
  id: string;
  profile_id: string;
  type: "contract" | "change_order" | "invoice" | "estimate";
  recipient_email: string;
  status: "success" | "failed";
  error_message: string | null;
  related_entity_id: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  profile_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type EstimateStatus = "draft" | "sent" | "viewed" | "accepted" | "declined";

export interface Estimate {
  id: string;
  profile_id: string;
  customer_id: string | null;
  job_id: string | null;
  estimate_number: string;
  title: string;
  scope_of_work: string | null;
  property_address_line_1: string | null;
  property_address_line_2: string | null;
  property_city: string | null;
  property_province: string | null;
  property_postal_code: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  deposit_amount: number | null;
  expiry_date: string | null;
  notes: string | null;
  status: EstimateStatus;
  public_token: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  responded_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  estimate_pdf_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  profile_id: string;
  customer_id: string;
  title: string;
  description: string | null;
  status: JobStatus;
  service_category: string | null;
  property_address_line_1: string | null;
  property_address_line_2: string | null;
  property_city: string | null;
  property_province: string | null;
  property_postal_code: string | null;
  estimated_price: number | null;
  deposit_amount: number | null;
  tax_rate: number;
  start_date: string | null;
  estimated_completion_date: string | null;
  actual_completion_date: string | null;
  contract_status: JobContractStatus;
  invoice_status: InvoiceStatus;
  active: boolean;
  archived_at: string | null;
  original_contract_price: number | null;
  approved_change_total: number;
  current_contract_total: number | null;
  created_at: string;
  updated_at: string;
}

export interface JobUpdate {
  id: string;
  job_id: string;
  category: UpdateCategory;
  title: string;
  note: string | null;
  date: string;
  created_at: string;
  updated_at: string;
  /** Present when contractor attached current device location to a camera-captured photo set */
  location_latitude: number | null;
  location_longitude: number | null;
  location_accuracy_meters: number | null;
  location_captured_at: string | null;
  location_source: "device_current" | null;
}

export interface JobUpdateAttachment {
  id: string;
  job_update_id: string;
  job_id: string | null;
  storage_path: string;
  file_name: string;
  file_size_bytes: number;
  file_type: string | null;
  original_file_name: string | null;
  mime_type: string | null;
  thumbnail_path: string | null;
  uploaded_by_user_id: string | null;
  captured_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string | null;
}

export interface StorageUsage {
  id: string;
  profile_id: string;
  total_bytes: number;
  photo_bytes_used: number;
  video_bytes_used: number;
  document_bytes_used: number;
  updated_at: string;
}

export interface JobWithCustomer extends Job {
  customers: Customer | null;
}

export interface JobUpdateWithAttachments extends JobUpdate {
  job_update_attachments: JobUpdateAttachment[];
}

export type ContractStatus = "draft" | "pending" | "signed" | "void";

/** Remote signing link lifecycle (contract_signing_tokens.status) */
export type ContractSigningTokenStatus = "active" | "used" | "cancelled";
export type SigningMethod = "device" | "remote";

export interface ContractData {
  scope?: string;
  terms?: string;
  paymentTerms?: string;
  startDate?: string;
  completionDate?: string;
  price?: number;
  deposit?: number;
}

export interface Contract {
  id: string;
  job_id: string;
  profile_id: string;
  version_number: number;
  status: ContractStatus;
  contract_data: ContractData;
  contractor_name: string | null;
  company_name: string | null;
  contractor_email: string | null;
  contractor_phone: string | null;
  contractor_address: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  job_title: string | null;
  job_address: string | null;
  scope_of_work: string | null;
  price: number | null;
  deposit_amount: number | null;
  payment_terms: string | null;
  tax_included: boolean;
  tax_rate: number;
  warranty_note: string | null;
  cancellation_change_note: string | null;
  pdf_path: string | null;
  signed_at: string | null;
  signer_name: string | null;
  signer_email: string | null;
  signer_phone: string | null;
  signing_method: SigningMethod | null;
  signature_image_path: string | null;
  signed_ip_address: string | null;
  signed_user_agent: string | null;
  consent_checkbox_boolean: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContractSigningToken {
  id: string;
  contract_id: string;
  token: string;
  expires_at: string;
  used_at: string | null;
  status: ContractSigningTokenStatus;
  created_at: string;
}

export type ChangeOrderStatus = "draft" | "sent" | "signed" | "declined";

export interface ChangeOrder {
  id: string;
  job_id: string;
  profile_id: string;
  change_title: string | null;
  change_description: string | null;
  reason_for_change: string | null;
  original_contract_price: number | null;
  change_amount: number | null;
  revised_total_price: number | null;
  new_estimated_start_date: string | null;
  new_estimated_completion_date: string | null;
  status: ChangeOrderStatus;
  pdf_path: string | null;
  /** Set when status becomes `sent`: how it was first sent for approval */
  sent_delivery_method: "email" | "device" | null;
  sent_at: string | null;
  signed_at: string | null;
  signing_method: string | null;
  signer_name: string | null;
  signer_email: string | null;
  signer_phone: string | null;
  signature_image_path: string | null;
  signed_ip_address: string | null;
  signed_user_agent: string | null;
  consent_checkbox_boolean: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItemRow {
  id: string;
  invoice_id: string;
  description: string;
  amount: number;
  quantity: number;
  sort_order: number;
  created_at: string;
}

export type InvoiceStatusType = "draft" | "sent" | "paid" | "overdue" | "partially_paid";

export interface InvoiceLineItem {
  description: string;
  amount: number;
  quantity?: number;
}

export interface InvoicePaymentRow {
  id: string;
  invoice_id: string;
  profile_id: string;
  amount: number;
  paid_on: string;
  payment_method: "e_transfer" | "cash" | "cheque" | "card" | "other";
  note: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  job_id: string;
  profile_id: string;
  /** Unguessable token for customer-facing /invoice/[token] (no auth). */
  public_token?: string;
  viewed_at?: string | null;
  invoice_number: string | null;
  status: InvoiceStatusType;
  subtotal: number;
  tax_amount: number;
  total: number;
  /** Pre-tax agreed work from signed contract + change orders at issue time */
  agreed_work_subtotal?: number | null;
  deposit_credited?: number;
  balance_due?: number;
  /** Sum of contractor-recorded payments (excludes deposit). */
  amount_paid_total?: number;
  last_payment_at?: string | null;
  /** Path in `invoice-pdfs` bucket: `{profile_id}/{invoice_id}.pdf` */
  invoice_pdf_path?: string | null;
  due_date: string | null;
  sent_at: string | null;
  paid_at: string | null;
  line_items: InvoiceLineItem[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}
