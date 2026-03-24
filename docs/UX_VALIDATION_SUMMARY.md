# UX, Validation & Workflow Improvements – Implementation Summary

## Updated Pages

| Page | Changes |
|------|---------|
| `/login` | Shows "Your account has been successfully verified. You can now sign in." when `?confirmed=true` |
| `/auth/callback` | Redirects to `/login?confirmed=true` after successful signup email confirmation (instead of dashboard) |
| `/signup` | `emailRedirectTo` now points to `/auth/callback?next=/login` so confirmation lands on login |
| `/jobs/create` | Removed customer address fields; removed estimated price; added required fields and email warning |
| `/jobs/[jobId]` | Added "Edit job" button; banner "Create a contract before starting work" when no contract; renamed buttons |
| `/jobs/[jobId]/edit` | **New** – Edit job form (job details, property address, contract price) |
| `/jobs/[jobId]/contract` | Contract builder validation before save/send; inline validation errors |
| `/dashboard` | Removed `estimated_price` from job display (uses `contract_price` only) |

---

## Validations Added

### Job creation (`createJob` action)
- `property_address_line_1` – required
- `property_city` – required
- `property_province` – required
- `contract_price` (original_contract_price) – required, must be > 0
- `customer_id` – required (unchanged)
- `title` – required (unchanged)

### Job creation form (client)
- Required: customer full_name, job title, property_address_line_1, property_city, property_province, contract_price
- Email warning: "We strongly recommend adding an email address for contracts and invoices" when email is missing but other customer fields are filled

### Job update (`updateJob` action)
- Same required fields as job creation for job-level fields

### Contract builder (before "Save and have customer sign on device" or "Send for remote signing")
- `scope_of_work` – required
- `contract_price` – required (> 0)
- `customer_name` – required (from job)
- `payment_terms` – required

### Contract server-side (`createOrUpdateContract` when status = "pending")
- Same four fields validated before allowing contract to be saved as pending or sent for signing

---

## Schema Impact

**None.** No migrations or schema changes.

- `estimated_price` remains in the database but is no longer used in the UI or in `createJob` inserts (column stays for compatibility).
- Customer `address_line_1`, `address_line_2`, `city`, `province`, `postal_code` remain in the schema; they are simply not collected in the job creation form.

---

## Button Renames

| Old | New |
|-----|-----|
| Add update | Add job update (photos/notes) |
| Change orders | Add change order |

---

## New Routes

- `/jobs/[jobId]/edit` – Edit job page
