# Supabase auth email templates (JobProof)

Copy each HTML file into **Supabase Dashboard → Authentication → Email Templates**.

Use **custom SMTP (Resend)** so emails send from `jeffrey@jobproof.ca` with sender name **JobProof** — see [docs/SUPABASE_AUTH_EMAIL_BRANDING.md](../../docs/SUPABASE_AUTH_EMAIL_BRANDING.md).

**Do not use `{{ .ConfirmationURL }}` for signup or password reset** — JobProof verifies via `/auth/callback?token_hash=...` (see `src/app/auth/callback/route.ts`).

| Template file | Supabase template | Subject (suggested) |
|---------------|-------------------|---------------------|
| `confirm-signup.html` | Confirm signup | Confirm your JobProof account |
| `reset-password.html` | Reset password | Reset your JobProof password |
| `magic-link.html` | Magic link | Sign in to JobProof |
| `invite-user.html` | Invite user | You're invited to JobProof |

Logo URL (production): `https://jobproof.ca/jobproof-logo.png`
