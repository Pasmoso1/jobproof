# Supabase Email Templates – Manual Configuration

Supabase email templates are configured in the **Supabase Dashboard**, not in code.

**Path:** Authentication → Email Templates → **Confirm signup**

---

## Important: Use direct callback URL (not ConfirmationURL)

**Do not use `{{ .ConfirmationURL }}`** for the link. Supabase’s default confirmation URL goes through its verify endpoint and may redirect with tokens in the URL hash, which your server cannot read. That leads to users seeing an error even when confirmation succeeds.

Use a **direct link** to your callback with `token_hash` and `type` in the query string instead.

---

## Confirm signup template

### Subject

```
Confirm your JobProof account
```

### Body (HTML)

Use the Supabase template editor. Replace the default body with this Supabase-safe HTML:

```html
<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #18181b;">
  <h1 style="font-size: 24px; font-weight: 600; margin: 0 0 24px; color: #18181b;">Welcome to JobProof</h1>
  
  <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px; color: #3f3f46;">
    Please confirm your email address to activate your account and start protecting your jobs.
  </p>
  
  <p style="margin: 24px 0;">
    <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/login" 
       style="display: inline-block; padding: 12px 24px; background-color: #2436BB; color: white; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
      Confirm your email
    </a>
  </p>
  
  <p style="font-size: 14px; line-height: 1.5; margin: 24px 0 0; color: #71717a;">
    If you did not create this account, you can ignore this email.
  </p>
</div>
```

### Variables used

| Variable | Description |
|----------|-------------|
| `{{ .SiteURL }}` | Your site URL from Supabase project settings (e.g. `https://yourdomain.com` or `http://localhost:3000`) |
| `{{ .TokenHash }}` | Token hash for verification. **Required** – do not remove. |

**Link format:** `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/login`

This sends users directly to your callback with the token in the query string so the server can verify it and redirect correctly.

### Redirect URL configuration

In **Authentication → URL Configuration**, ensure:

- **Site URL:** `https://yourdomain.com` (or `http://localhost:3000` for dev)
- **Redirect URLs:** include  
  `http://localhost:3000/auth/callback`  
  `https://yourdomain.com/auth/callback`

---

## Plain text fallback (if needed)

```
Welcome to JobProof.

Please confirm your email address to activate your account and start protecting your jobs.

Confirm your email: {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/login

If you did not create this account, you can ignore this email.
```

---

## Flow summary

### Callback flow (email confirmation link)

1. User clicks the confirmation link in the email → goes directly to `/auth/callback?token_hash=...&type=email&next=/login` (token in query, not hash)
2. `src/app/auth/callback/route.ts` calls `supabase.auth.verifyOtp()`
3. On success with `type === "signup"` or `type === "email"` → redirect to `/login?confirmed=true`
4. On success with other types (e.g. magic link, recovery) → redirect to `next` param or `/`
5. On failure (invalid/expired token) → redirect to `/login?error=auth`
6. Login page reads `confirmed=true` or `error=auth`, shows the appropriate message, then clears the query param

### Resend flow

1. User tries to sign in before confirming → sees "email not confirmed" error with "Resend confirmation email" button (login) or "Check your email" screen with resend button (signup)
2. User clicks resend → `supabase.auth.resend()` with `emailRedirectTo: /auth/callback?next=/login`
3. On success → show: "We sent a new confirmation email. Please check your inbox and spam folder."
4. On error → show the error message

### What was changed (code)

- **Login page:** Friendlier "Invalid login credentials" message; Create account / Forgot password links; success message after confirmation; resend success/error feedback
- **Signup page:** Resend success/error feedback; `emailRedirectTo` set to `/auth/callback?next=/login`
- **Auth callback:** Handles both `type=signup` and `type=email` for signup confirmation redirect
- **Email template:** Must use direct link with `token_hash` and `type=email` in query (not `{{ .ConfirmationURL }}`) so the server can verify and redirect correctly
