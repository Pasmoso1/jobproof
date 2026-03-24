# Contract Builder & Preview Improvements

## Summary of Changes

### 1. Contract details summary (builder)

A read-only **Contract details** section now appears at the top of the contract builder showing:

- **Customer** – Full name
- **Property address** – Full property address
- **Contract price** – Total contract amount
- **Payment terms** – Current payment terms text

These fields are pulled from the job and form state so contractors can quickly confirm key details before editing or sending.

---

### 2. Contract preview (agreement-style)

A new **ContractPreview** component renders the contract as a structured agreement instead of a simple form. It includes:

| Section | Content |
|---------|---------|
| **Document header** | Title, job name, preparation date |
| **Contractor** | Contractor information |
| **Customer** | Name, email, phone |
| **Job & Property** | Job title, property address, start/completion dates |
| **Scope of Work** | Full scope text |
| **Contract Price** | Total and deposit |
| **Payment Terms** | Payment terms text |
| **Terms and Conditions** | Terms text (if provided) |
| **Signature** | Placeholder for customer signature and date |

The preview uses clear section labels, spacing, and a document-style layout so it reads like a formal agreement.

---

### 3. Where the preview is used

- **Contract builder** (`/jobs/[jobId]/contract`) – Below the editable fields, with the note: “This is how the contract will appear to the customer.”
- **Device signing** (`/jobs/[jobId]/contract/sign`) – Full agreement preview before the customer signs on the contractor’s device.
- **Remote signing** (`/sign/[token]`) – Full agreement preview before the customer signs via email link.

---

### 4. Send/sign actions

- **Section header**: “Ready to send or sign” with a short explanation.
- **Helper text**: “Save a draft to continue later, or proceed to have the customer sign.”
- **Action grouping**: Save draft, device signing, and remote signing are grouped together with consistent styling.

---

### 5. Migration

**`008_contract_signing_token_fields.sql`** – Extends `get_contract_by_signing_token` to return:

- `job_address`
- `customer_email`
- `customer_phone`

This supports the full contract preview on the remote signing page.

**Run the migration** before testing remote signing:

```bash
supabase db push
# or
supabase migration up
```

---

## Files changed

| File | Change |
|------|--------|
| `contract-preview.tsx` | **New** – Agreement-style preview component |
| `contract-builder-form.tsx` | Contract details summary, preview, and updated action section |
| `device-signing-form.tsx` | Uses ContractPreview instead of minimal summary |
| `contract/sign/page.tsx` | Passes job/customer/property data into DeviceSigningForm |
| `sign/[token]/page.tsx` | Uses ContractPreview for remote signing |
| `contract/page.tsx` | Max width increased to 4xl |
| `008_contract_signing_token_fields.sql` | **New** – Migration for signing token RPC |
