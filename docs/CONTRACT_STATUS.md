# Contract status transitions

Contract rows use `contracts.status`. Jobs mirror progress in `jobs.contract_status` for the same draft/pending/signed flow.

## Allowed transitions

| From | To | How |
|------|-----|-----|
| *(none)* | `draft` | `createOrUpdateContract` with intent **`save_draft`** (insert). |
| *(none)* | `pending` | `createOrUpdateContract` with intent **`submit_for_signing`** (insert, validated). |
| `draft` | `draft` | **`save_draft`** (update). |
| `draft` | `pending` | **`submit_for_signing`** (validated) or `sendContractForSigning` after draft. |
| `pending` | `pending` | **`submit_for_signing`** (re-validates, refreshes content) or **`save_pending_edits`** (no signing validation). |
| `pending` | `draft` | **`withdraw_to_draft`** only (explicit user action + confirm in UI). |
| `*` | `signed` | Signing flows (`sign_contract_device`, `sign_contract_remote`, etc.). |
| `signed` | * | **Blocked** by DB trigger and app checks (use change orders for amendments). |

## Intents (`ContractSaveIntent`)

- **`save_draft`** — Saves as draft. **Rejected** if the current editable row is already `pending` (prevents silent demotion).
- **`submit_for_signing`** — Requires business profile + scope/price/customer/payment terms; sets status to **`pending`**.
- **`save_pending_edits`** — Only when status is **`pending`**; updates JSON/columns, keeps **`pending`**.
- **`withdraw_to_draft`** — Only when **`pending`** → **`draft`**; explicit withdrawal from “awaiting signature”.

## `void`

Supported in the schema/types for jobs/contracts but **not** used in the current UI or server actions. Treat as reserved for future workflows.

## Remote signing tokens (`contract_signing_tokens`)

Each row has **`status`**: `active` | `used` | `cancelled`.

- **New links** are created as **`active`** (`createSigningToken`).
- **Successful remote sign** sets **`used`** and `used_at` (`sign_contract_remote`).
- **`pending` → `draft`** on the contract (e.g. **Move back to draft**) fires a DB trigger that sets all **`active`** tokens for that contract to **`cancelled`**.

`get_remote_signing_bundle` / RPCs require **`active`**, unused, unexpired tokens and **`contracts.status = 'pending'`**.

## Notes

- Creating a new contract is blocked if a **`signed`** row already exists for the job.
- **`signed`** contracts are unchanged by token cancellation; withdrawal only applies when moving **`pending` → `draft`**.
