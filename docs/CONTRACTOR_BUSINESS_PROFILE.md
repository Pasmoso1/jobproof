# Contractor Business Profile – Implementation Summary

## Migration

**`009_contractor_business_profile.sql`**

Adds to `profiles`:
- `business_name` (text)
- `contractor_name` (text)
- `phone` (text)
- `address_line_1`, `address_line_2`, `city`, `province`, `postal_code` (text)

**`010_contractor_contract_fields.sql`**

Adds to `contracts`:
- `contractor_email`, `contractor_phone`, `contractor_address` (text)

Extends `get_contract_by_signing_token` to return `company_name`, `contractor_name`, `contractor_email`, `contractor_phone`, `contractor_address`.

---

## New Page

**`/settings/business`**

| Field | Required | Notes |
|-------|----------|-------|
| business_name | Yes | Required for contracts/invoices |
| contractor_name | No | Fallback if no business name |
| email | No | Read-only from auth |
| phone | No | |
| address_line_1, address_line_2, city, province, postal_code | No | |

---

## Where Business Info Is Displayed

| Location | Content |
|----------|---------|
| **Contract preview** | business_name, contractor email, phone, address |
| **Contract builder** | Contractor section in preview |
| **Device signing** | Contractor section in preview |
| **Remote signing** | Contractor section in preview |
| **Invoices page** | business_name + contact details at top |
| **Proof report** | Contractor section with business_name, phone, address |

---

## Validation Rules

| Action | Blocked if | Message |
|--------|------------|---------|
| Save contract (pending) | `business_name` missing | "Please add your business details before proceeding. Go to Settings to add your business name." |
| Send contract for signing | `business_name` missing | Same |
| Send change order for signing | `business_name` missing | Same |
| Create invoice | `business_name` missing | Same |

Each blocked action includes a link to `/settings/business`.

---

## UX

- **Banner** on dashboard and job pages when business profile is incomplete:  
  "Complete your business profile to send contracts and invoices"

- **Settings** link in nav header

---

## Run Migrations

If 008 was already applied, run only 009 and 010:

```bash
supabase db push
```

Or apply individually:
```bash
supabase migration up   # applies 009 and 010
```
