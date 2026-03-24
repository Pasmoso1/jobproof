# Auth Flow Summary

## New Auth Pages & Routes

| Route | Purpose |
|-------|---------|
| `/login` | Sign in (existing, enhanced with forgot-password link, unconfirmed-email handling, auth-error handling) |
| `/signup` | Sign up (existing, enhanced with confirmation screen and resend) |
| `/forgot-password` | Request password reset email |
| `/update-password` | Set new password after clicking reset link (handles Supabase recovery flow) |
| `/auth/callback` | Handles Supabase redirects (email confirmation, password recovery). Exchanges `token_hash` via `verifyOtp`, then redirects to `next` or `/login?error=auth` on failure |

---

## Supabase Auth Settings

### 1. Redirect URLs (Authentication → URL Configuration)

Add these to **Redirect URLs** in Supabase Dashboard → Authentication → URL Configuration:

**Development:**
```
http://localhost:3000/auth/callback
http://localhost:3000/update-password
```

**Production (replace with your domain):**
```
https://yourdomain.com/auth/callback
https://yourdomain.com/update-password
```

### 2. Email Confirmation

- **Confirm email** must be **enabled** for signup confirmation flow.
- Supabase Dashboard → Authentication → Providers → Email → **Confirm email** = ON

### 3. Email Templates (optional)

Customize in Supabase Dashboard → Authentication → Email Templates:
- **Confirm signup** – link points to `/auth/callback?token_hash=...&type=signup&next=/dashboard`
- **Reset password** – link points to `/auth/callback?token_hash=...&type=recovery&next=/update-password`

Supabase sets the redirect URL from the `emailRedirectTo` / `redirectTo` options passed in the API calls.

---

## Test Steps

### Signup confirmation

1. Go to `/signup` and sign up with a new email.
2. You should see the confirmation screen: “A confirmation email has been sent…”, with **Resend confirmation email** and **Back to sign in**.
3. Try signing in before confirming → you should see “Your email address has not been confirmed yet…” with a resend option.
4. Open the confirmation email and click the link.
5. You should be redirected to `/dashboard` (or the `next` URL).
6. Sign in again → you should be logged in.

### Password reset

1. Go to `/login` and click **Forgot your password?**
2. Enter your email and submit.
3. You should see “Check your email for a reset link.”
4. Open the reset email and click the link.
5. You should land on `/update-password`.
6. Enter a new password and confirm.
7. You should be redirected to `/login` with a success message.
8. Sign in with the new password.

### Invalid/expired links

- **Confirmation link:** Click an old/expired confirmation link → redirected to `/login?error=auth` with “The confirmation or reset link was invalid or has expired…”
- **Reset link:** Go to `/update-password` without a valid session → “Invalid or expired link” with **Request new reset link** and **Back to sign in**.
