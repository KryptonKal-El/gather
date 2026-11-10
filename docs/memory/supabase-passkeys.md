# Supabase passkeys (beta)

Gather uses Supabase Auth's built-in passkeys (beta since 2026-05). No custom WebAuthn backend.

## Setup facts
- **RP ID is `gatherlists.com` and must never change.** Changing it makes every existing passkey unusable.
- Enabled in **Dashboard → Authentication → Passkeys** (never `supabase config push`, see the MCP memory).
- supabase-js ≥2.105 (we're on 2.119). The `experimental: { passkey: true }` client flag is **deprecated and ignored** from ~2.119; passkeys are on by default in the client.
- supabase-swift ≥2.48, with `@_spi(Experimental) import Supabase`.
- iOS needs `webcredentials:gatherlists.com` in the app's associated domains; the AASA in `public/.well-known/` already lists `webcredentials`.

## Testing on the iOS simulator
- The simulator refuses passkeys until Face ID is enrolled ("Simulator requires enrolled biometrics"). Enroll and approve from the shell:
  ```bash
  xcrun simctl spawn <udid> notifyutil -s com.apple.BiometricKit.enrollmentChanged 1
  xcrun simctl spawn <udid> notifyutil -p com.apple.BiometricKit.enrollmentChanged
  # while the Face ID scan is showing:
  xcrun simctl spawn <udid> notifyutil -p com.apple.BiometricKit_Sim.pearl.match
  ```
- Verified end to end on 2026-11-09 with the e2e test account: register in Settings → sign out → "Sign in with a passkey" → signed in, "Last used" updated. The AASA from Apple's CDN already worked, so no `?mode=developer` was needed.
- New Swift files must be added to `project.pbxproj` by hand (the project doesn't use synchronized folders).

## Gotchas
- **Web passkeys don't work on localhost.** The browser requires the page host to match the RP ID, so a real ceremony only runs on gatherlists.com. Locally you can only check UI and error states.
- When the Dashboard toggle is off, every passkey call fails with `error.code === 'passkey_disabled'` (HTTP 404 on list). `PasskeysSection` hides itself on that code, and the login autofill swallows it, so the web build is safe to deploy before the toggle is flipped.
- A dismissed browser prompt arrives as a `WebAuthnError` with `cause.name === 'NotAllowedError'`; see `src/utils/passkeyErrors.js`.
- Conditional UI (passkey autofill) needs `autocomplete="username webauthn"` on the email field, and must be aborted before a modal `signInWithPasskey()` call when you pass your own `signal`.
- Beta reports: hosted config sometimes doesn't propagate on the Free plan (toggling an unrelated auth setting fixes it); third-party managers like Dashlane can fail registration with `webauthn_verification_failed`.
- Passkeys can't create accounts; registration needs an existing confirmed user. That's why passwords can only be dropped after email-code sign-in exists.

## Email one-time codes (Phase 2)
- `signInWithOtp({ email, options: { shouldCreateUser: true } })` then `verifyOtp({ email, token, type: 'email' })`. `type: 'email'` covers both new and existing users.
- The email only shows a code if the Dashboard templates include `{{ .Token }}`: **Magic Link** (existing users) and **Confirm signup** (new users). With the default templates users get a link, not a code.
- Code length is a hosted setting (6 by default, up to 8), so the UIs accept 6–8 digits instead of auto-submitting at 6.
- Auth emails go through **Resend custom SMTP** (since 2026-11-09): sender `hello@gatherlists.com`, host `smtp.resend.com:465`, user `resend`, password = a sending-only Resend API key. DNS is at Namecheap: `send` (CNAME to Resend), `resend._domainkey` (DKIM TXT), `_dmarc` (`p=none`). The root MX/SPF are Namecheap email forwarding, so leave them alone. If code emails stop arriving, check the Resend Emails log first, then Supabase → Authentication → Rate Limits (emails per hour).
- Wrong or expired codes come back as `otp_expired`; resending too soon is `over_email_send_rate_limit` (Supabase enforces ~60s between sends, which the UIs mirror with a countdown).

## Passwords removed from the UI (Phase 3)
- Sign-in is Passkey · Apple · Email code on web (`Login.jsx`), the OAuth consent page (`OAuthConsent.jsx`) and iOS (`LoginView.swift` → "Continue with Email" sheet). `EmailCodeForm` takes `onSendCode`/`onVerifyCode` props so the consent page (outside `AuthProvider`) can pass raw supabase calls.
- **The email provider stays enabled on the server with passwords allowed.** Old password users just sign in with a code instead (same email = same account). Tests still use the e2e account's password:
  - Playwright: `e2e/testAccount.js` → `signInTestAccount(page)` imports `/src/services/supabase.js` from the Vite dev server and calls `signInWithPassword`, so the app's own client instance signs in.
  - iOS UI tests: Debug builds sign in automatically when `TEST_USER_EMAIL` + `TEST_USER_PASSWORD` are in the launch environment (`AuthViewModel.signInForUITestsIfRequested`).
