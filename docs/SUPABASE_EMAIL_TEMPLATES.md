# Supabase email templates (legacy pointer)

**→ Use the full production guide:** [SUPABASE_AUTH_EMAIL_BRANDING.md](./SUPABASE_AUTH_EMAIL_BRANDING.md)

**→ Copy HTML from:** [`emails/supabase-auth/`](../emails/supabase-auth/)

---

## Confirm signup — link format (required)

Do **not** use `{{ .ConfirmationURL }}`. Use:

```
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/login
```

See `src/app/auth/callback/route.ts` and [AUTH_FLOW.md](./AUTH_FLOW.md).

---

## Subject lines

| Template | Subject |
|----------|---------|
| Confirm signup | Confirm your JobProof account |
| Reset password | Reset your JobProof password |
| Magic link | Sign in to JobProof |
| Invite user | You're invited to JobProof |
