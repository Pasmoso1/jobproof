# JobProof — Supabase auth email branding (production)

This guide configures **custom SMTP (Resend)**, **sender branding**, and **HTML templates** so auth emails come from **jeffrey@jobproof.ca** as **JobProof** — with no “Supabase Auth” / “powered by Supabase” footer.

**No app code changes are required** for branding. Auth flows stay the same (`/auth/callback`, `token_hash`, `verifyOtp`).

**Template files (copy/paste):** [`emails/supabase-auth/`](../emails/supabase-auth/)

---

## 1. Custom SMTP — Resend in Supabase

### Prerequisites

1. **Resend account** with domain **`jobproof.ca` verified**  
   [Resend → Domains](https://resend.com/domains) → Add domain → add DNS records Resend shows.
2. **Resend API key** with “Sending access”  
   [Resend → API Keys](https://resend.com/api-keys) → Create API Key.
3. **Supabase project** on a plan that supports **Custom SMTP** (typically **Pro** or higher; check [Supabase pricing](https://supabase.com/pricing) → Auth / Custom SMTP).

### Resend SMTP values

| Setting | Value |
|--------|--------|
| **Host** | `smtp.resend.com` |
| **Port** | `465` (SSL) — or `587` (STARTTLS) if 465 is blocked |
| **Username** | `resend` |
| **Password** | Your Resend **API key** (starts with `re_`) |
| **Sender email** | `jeffrey@jobproof.ca` |
| **Sender name** | `JobProof` or `JobProof Support` |

Source: [Resend SMTP docs](https://resend.com/docs/send-with-smtp).

### Where to paste in Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. **Project Settings** (gear) → **Authentication** → **SMTP Settings**  
   *(Some dashboards: **Authentication** → **Email** → **SMTP Settings**.)*
3. Enable **Custom SMTP**.
4. Fill in host, port, user, password, sender email, sender name (table above).
5. Save.

### Send a test

1. **Authentication** → **Users** → invite or use “Send password recovery” on a test user.  
2. Or sign up on staging with a new email.  
3. Confirm **From** shows `JobProof <jeffrey@jobproof.ca>` (or your sender name) and body uses your template.

### Optional: align app transactional mail

App emails (invoices, contracts) use `RESEND_FROM` in Vercel. For consistency you may set:

```env
RESEND_FROM=JobProof <jeffrey@jobproof.ca>
```

Auth mail is controlled only by **Supabase SMTP**, not `RESEND_FROM`.

---

## 2. DNS — SPF, DKIM, DMARC (jobproof.ca)

Add these in your DNS host (Cloudflare, Google Domains, etc.) using the **exact** records from Resend after adding `jobproof.ca`.

### Typical records (verify in Resend dashboard)

| Type | Purpose |
|------|---------|
| **TXT (SPF)** | Authorizes Resend to send for `@jobproof.ca` (often `v=spf1 include:amazonses.com ~all` or Resend’s current SPF include). |
| **CNAME (DKIM)** | One or more `resend._domainkey` (or similar) CNAMEs — **required** for inbox placement. |
| **TXT (DMARC)** | Recommended: `v=DMARC1; p=none; rua=mailto:jeffrey@jobproof.ca` while monitoring, then tighten to `quarantine` / `reject` when stable. |

### Checklist

- [ ] Domain shows **Verified** in Resend.
- [ ] SPF = pass on a test message ([mail-tester.com](https://www.mail-tester.com/) optional).
- [ ] DKIM = pass.
- [ ] DMARC record published (even `p=none` helps reporting).
- [ ] `jeffrey@jobproof.ca` is allowed (any verified address on the domain can send).

**Supabase default mail** does not use your domain — switching to Resend SMTP is what fixes “via Supabase” / poor deliverability.

---

## 3. Sender name (“Supabase Auth” → “JobProof”)

Set in **SMTP Settings**:

- **Sender name:** `JobProof` (recommended) or `JobProof Support`

That replaces the default **Supabase Auth** display name. The address should be `jeffrey@jobproof.ca`.

---

## 4. URL configuration (required — do not skip)

**Authentication** → **URL Configuration**

| Field | Production | Local dev |
|-------|------------|-----------|
| **Site URL** | `https://jobproof.ca` | `http://localhost:3000` |
| **Redirect URLs** | `https://jobproof.ca/auth/callback` | `http://localhost:3000/auth/callback` |
| | `https://jobproof.ca/update-password` | `http://localhost:3000/update-password` |

`{{ .SiteURL }}` in templates uses **Site URL**.

---

## 5. Email templates — paste from repo

**Authentication** → **Email Templates**

For each template, set **Subject** and paste **Body (HTML)** from the matching file.

| Template | Subject | HTML file |
|----------|---------|-----------|
| Confirm signup | `Confirm your JobProof account` | [`confirm-signup.html`](../emails/supabase-auth/confirm-signup.html) |
| Reset password | `Reset your JobProof password` | [`reset-password.html`](../emails/supabase-auth/reset-password.html) |
| Magic link | `Sign in to JobProof` | [`magic-link.html`](../emails/supabase-auth/magic-link.html) |
| Invite user | `You're invited to JobProof` | [`invite-user.html`](../emails/supabase-auth/invite-user.html) |

### Critical link rules (do not break auth)

| Template | Link pattern | Why |
|----------|--------------|-----|
| **Confirm signup** | `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/login` | Server reads `token_hash` in query; avoids hash-only tokens. See `src/app/auth/callback/route.ts`. |
| **Reset password** | `...&type=recovery&next=/update-password` | Matches `resetPasswordForEmail` redirect in `src/app/forgot-password/page.tsx`. |
| **Magic link** | `...&type=magiclink&next=/dashboard` | OTP type for magic link sign-in. |
| **Invite user** | `{{ .ConfirmationURL }}` | Supabase invite flow; test before changing. |

**Do not use `{{ .ConfirmationURL }}` for signup or reset** unless you re-test the full flow — JobProof intentionally uses direct `token_hash` links.

### Variables you may use (Supabase Go templates)

| Variable | Use |
|----------|-----|
| `{{ .SiteURL }}` | App origin from URL config |
| `{{ .TokenHash }}` | OTP verification (signup, reset, magic link) |
| `{{ .Email }}` | Recipient email |
| `{{ .ConfirmationURL }}` | Invite only (default Supabase link) |

Do not remove `{{ .TokenHash }}` or `{{ .SiteURL }}` from CTA URLs.

---

## 6. Branding reference

| Element | Value |
|---------|--------|
| Primary CTA | `#2436BB` (hover `#1c2a96` in app) |
| Accent / tagline | `#818cf8` |
| Dark card | `#18181b` on `#09090b` |
| Logo | `https://jobproof.ca/jobproof-logo.png` |
| Tagline | Protect your jobs. Get paid. Stay protected. |

Templates are table-based for Outlook/Gmail mobile compatibility.

---

## 7. Remove Supabase branding

After custom SMTP + custom HTML:

- No **“powered by Supabase”** footer (not in our templates).
- No **Supabase Auth** sender (replaced by SMTP sender name).
- No default Supabase template body.

If you still see Supabase branding, **Custom SMTP is not enabled** or the wrong template is still the default.

---

## 8. Security footer copy

All templates include:

> If you did not create this account / request this link, you can safely ignore this email.

(Reset template says “password will not change”.)

---

## 9. Testing checklist

### Setup

- [ ] `jobproof.ca` verified in Resend (SPF/DKIM green).
- [ ] Supabase Custom SMTP saved with `jeffrey@jobproof.ca` + sender name **JobProof**.
- [ ] Site URL + redirect URLs include production (and staging if used).
- [ ] All four HTML templates pasted and saved.

### Confirm signup

- [ ] New signup at `/signup` → email arrives from **JobProof** / `jeffrey@jobproof.ca`.
- [ ] Dark branded layout, logo, blue CTA **Confirm your email**.
- [ ] Click CTA → lands on `/auth/callback` → then dashboard or login with success state.
- [ ] Resend confirmation from login still works.

### Password reset

- [ ] `/forgot-password` → email branded.
- [ ] CTA → `/update-password` after callback.
- [ ] Set new password → login works.

### Magic link (if enabled)

- [ ] Send magic link → branded email → sign-in completes.

### Invite (if used)

- [ ] Invite user from Supabase → **Accept invitation** works with `{{ .ConfirmationURL }}`.

### Mobile & deliverability

- [ ] Read on iPhone Mail + Gmail app — button tappable, no horizontal scroll.
- [ ] Message not in spam (after DKIM verified).
- [ ] “From” shows **JobProof** not Supabase.

---

## 10. Supabase limitations & notes

| Topic | Note |
|-------|------|
| **Custom SMTP plan** | May require paid Supabase tier; built-in mail is rate-limited and Supabase-branded. |
| **Rate limits** | Resend + Supabase auth rate limits still apply; watch Resend dashboard. |
| **Template editor** | Paste full HTML; Supabase may strip some tags — if preview breaks, test a real send. |
| **Invite vs OTP** | Invite uses `ConfirmationURL`; signup/reset use `TokenHash` + your callback. |
| **PKCE `code` flow** | Callback also handles `?code=`; templates focus on `token_hash` path used by custom links. |
| **Multiple environments** | Use separate Supabase projects or swap Site URL when testing locally. |
| **Logo hosting** | Logo URL must be public HTTPS (`jobproof.ca`); do not use localhost in production templates. |
| **Changing email** | Update templates in Dashboard only; repo files are source of truth for version control. |

---

## 11. Files / settings changed (reference)

| Location | What |
|----------|------|
| `emails/supabase-auth/*.html` | Branded HTML (version controlled) |
| `docs/SUPABASE_AUTH_EMAIL_BRANDING.md` | This guide |
| `docs/SUPABASE_EMAIL_TEMPLATES.md` | Legacy confirm-signup notes (see new doc) |
| **Supabase Dashboard** | SMTP, sender, URL config, email templates |
| **Resend Dashboard** | Domain, DNS, API key |
| **DNS host** | SPF, DKIM, DMARC for `jobproof.ca` |

**Not changed:** `src/app/auth/callback/route.ts`, signup/login/forgot-password logic, or token handling.

---

## Quick start (5 minutes)

1. Verify `jobproof.ca` in Resend + DNS.
2. Supabase → SMTP → Resend credentials, sender `JobProof <jeffrey@jobproof.ca>`.
3. Paste four HTML files from `emails/supabase-auth/`.
4. Confirm Site URL = `https://jobproof.ca`.
5. Sign up with a test email and click through once.
