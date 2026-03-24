# Signed contract emails (customer + contractor)

## When

Emails are sent **once**, immediately **after** a successful contract signature (on-device or remote link), from `deliverSignedContract` in `actions.ts`.

## Who receives what

| Recipient | Condition | Subject (example) | Contents |
|-----------|-----------|-------------------|----------|
| **Customer** | `signer_email` or `customer_email` is set | `Signed copy: {job title}` | Thank-you intro, PDF note, **HTML table summary** of the agreement, optional in-app link if they share the contractor email |
| **Contractor** | `contractor_email` is set **and** it is **not** the same address as the customer email | `Contract signed: {job title}` | Summary table, **“Open contract in JobProof”** link to `/jobs/{jobId}/contract`, same PDF attachment rules |
| **Same email for both** | Customer and contractor addresses match (case-insensitive) | One **customer**-styled email only | Summary + attachment rules + extra line with the in-app contract link (no duplicate send) |

## PDF attachment

- **Today:** `generateSignedContractPdf` is a placeholder (`null`). No PDF is generated or attached.
- **When PDF exists:** If `pdf_path` is set and `SUPABASE_SERVICE_ROLE_KEY` is configured, the file is downloaded from the `contract-pdfs` bucket and attached to **both** emails (customer and contractor sends).
- **Without service role:** Summary emails still send; attachment is skipped if the file cannot be downloaded server-side.

## Written summary (always in the email body)

Rows include: contract/job title, property address, estimated start & completion (from `contract_data`), contract price, deposit, scope excerpt (~450 chars), payment terms excerpt (~800 chars).

## Infrastructure

- **Resend:** Same pattern as signing-link emails (`RESEND_API_KEY`, `RESEND_FROM`). From header: `{company_name} via JobProof` when `company_name` exists on the contract.
- **Dev / no API key:** In development, delivery is treated as success without sending (see `sendSignedContractEmail`). In production, missing key returns failure and logs a warning.
- **Audit:** Each send attempt is logged to `email_logs` when `deliveryLog` is passed (per recipient).
