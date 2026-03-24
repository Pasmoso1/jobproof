# JobProof MVP End-to-End Testing Checklist

Use this checklist to verify the full demo flow from signup to proof report.

---

## Prerequisites

- Supabase project with migrations 001–007 applied
- App running locally (`npm run dev`)
- Email for signup (Supabase may require email confirmation; check Auth settings)

---

## 1. Signup and Dashboard

- [ ] Go to `/` (landing page)
- [ ] Click **Sign in** or navigate to `/login`
- [ ] Click **Create account** link to go to `/signup`
- [ ] Enter email and password (min 6 chars)
- [ ] Click **Create account**
- [ ] You should land on **Dashboard** (`/dashboard`)
- [ ] Verify: Plan, Active jobs, Storage, and "Create job" quick action are visible
- [ ] Verify: "Recent jobs" section shows "No jobs yet" or existing jobs

---

## 2. Create Customer and Job

- [ ] Click **Create job** (header or dashboard)
- [ ] Select **Create new** customer
- [ ] Fill customer: Name, Email, Phone, Address (at least Name)
- [ ] Fill job: Title (required), Description, Property address, Contract price ($)
- [ ] Click **Save and create contract**
- [ ] You should land on **Contract builder** (`/jobs/[jobId]/contract`)
- [ ] Verify: Job appears on dashboard with customer name and price

---

## 3. Add Grouped Update with Multiple Attachments

- [ ] From job page, click **Add update**
- [ ] Select **Category** (e.g. Progress)
- [ ] Enter **Title** (e.g. "Initial inspection photos")
- [ ] Enter **Note** (optional)
- [ ] Click **Attachments** and select 2+ files (images or PDFs, max 10MB each)
- [ ] Click **Save update**
- [ ] You should return to job page
- [ ] Verify: Timeline shows the update with attachment count (e.g. "📎 filename.pdf")
- [ ] Verify: Attachments appear under the update

---

## 4. Create and Sign Contract on Device

- [ ] From job page, click **Create contract** or **Contract (pending)**
- [ ] Fill **Scope of work**, **Terms and conditions**, **Payment terms**
- [ ] Click **Save and have customer sign on device**
- [ ] You should land on **Customer signs on device** (`/jobs/[jobId]/contract/sign`)
- [ ] Enter customer name, email, phone
- [ ] Check consent checkbox
- [ ] Click **Customer signs contract**
- [ ] You should return to job page
- [ ] Verify: Contract section shows "Signed" with date and method
- [ ] Verify: Job shows "Contract: signed"

---

## 5. Create and Sign Contract by Remote Link

*(Use a fresh job for this flow, or skip if you already signed on device.)*

- [ ] Create a new job with a customer that has an email
- [ ] Go to **Contract** → fill scope/terms → click **Send for remote signing**
- [ ] Check console/logs for signing URL (delivery is placeholder)
- [ ] Copy the signing URL (e.g. `http://localhost:3000/sign/[token]`)
- [ ] Open in incognito or different browser (unauthenticated)
- [ ] Enter name, email, phone, check consent
- [ ] Click **Sign contract**
- [ ] Verify: Success message appears
- [ ] Return to job in main browser and refresh
- [ ] Verify: Contract shows as signed

---

## 6. Create and Sign Change Order

- [ ] From job page, click **Change orders**
- [ ] Click **Create change order (draft)**
- [ ] Fill: Title, Description, Reason, Change amount (e.g. +500)
- [ ] Verify: Revised total updates
- [ ] Click **Create draft**
- [ ] Click **Send for signing**
- [ ] Click **Sign on device**
- [ ] Enter customer name, email, check consent
- [ ] Click **Customer signs change order**
- [ ] Verify: Change order shows "signed" with amount and revised total
- [ ] Verify: Job page shows updated signed total and current total

---

## 7. Create Invoice with Multiple Line Items

- [ ] From job page, click **Invoices**
- [ ] Add line items: Description + Amount (e.g. "Deposit" 500, "Balance" 1500)
- [ ] Click **+ Add line item** to add more
- [ ] Set tax rate (e.g. 0.13)
- [ ] Set due date (optional)
- [ ] Click **Create invoice**
- [ ] Verify: Invoice appears in "Invoice history" with total and status
- [ ] Verify: Subtotal + tax = total

---

## 8. View Proof Report

- [ ] From job page, click **Proof report**
- [ ] Verify **Job summary**: Customer, address, original contract, signed changes, current total
- [ ] Verify **Signed contract** section (if contract signed)
- [ ] Verify **Signed change orders** section (if any signed)
- [ ] Verify **Timeline updates** section
- [ ] Verify **Attachments / photo evidence** count
- [ ] Verify **Invoice summary** with link to invoices

---

## Quick Demo Path (Single Job)

1. Signup → Dashboard  
2. Create job (new customer) → Save and create contract  
3. Fill contract → Save and have customer sign on device  
4. Sign on device (customer info + consent)  
5. Add update with 2 attachments  
6. Create change order draft → Send for signing → Sign on device  
7. Create invoice with 2+ line items  
8. View proof report  

---

## Common Issues

- **"Not authenticated"**: Ensure you're logged in; try `/login`
- **Storage upload fails**: Check `job-attachments` bucket exists and RLS policies
- **Contract/change order not found**: Ensure status is `pending`/`sent` before signing
- **Customer shows "Unknown"**: Check job has `customer_id` and customer has `full_name`
