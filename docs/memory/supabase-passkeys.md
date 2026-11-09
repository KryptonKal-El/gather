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
