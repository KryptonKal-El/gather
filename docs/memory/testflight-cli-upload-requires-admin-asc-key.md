# CLI TestFlight uploads need an Admin App Store Connect API key

## Problem

`make testflight` (xcodebuild -exportArchive with destination upload) failed with:

```
error: exportArchive Cloud signing permission error
error: exportArchive No signing certificate "iOS Distribution" found
```

even though the same API key authenticated fine against the ASC API (list apps
returned 200) and the archive step succeeded.

## Cause

This machine has no local "Apple Distribution" certificate — past releases went
through Xcode Organizer, which signs with Apple's **cloud-managed distribution
certificate** tied to the Apple ID session. From the CLI, cloud signing is only
allowed if the App Store Connect API key has the **Admin** role. An App Manager
key can upload builds but cannot use the cloud certificate.

Also: an ASC API key's role is **immutable** — there is no way to upgrade an
existing key. You must generate a new key with the Admin role (the Issuer ID
stays the same; only the Key ID changes).

## Fix

- Admin key lives at `~/.appstoreconnect/private_keys/AuthKey_<ASC_KEY_ID>.p8`
  (never committed); `ASC_KEY_ID` is set in `ios-native/GatherLists/Makefile`.
- Alternative that avoids an Admin key: create a local Apple Distribution
  certificate (Xcode > Settings > Accounts > Manage Certificates), then an App
  Manager key suffices.

## Related gotchas

- A failed `make testflight` still burns a build number: the bump happens in
  the archive build phase, and the archive succeeds before the export fails.
  Recover by re-running `xcodebuild -exportArchive` directly against the
  existing `.xcarchive` instead of re-running the full target.
- `xcrun altool --list-apps` may report "No applications found" even when the
  key is valid — verify against the ASC REST API instead of trusting altool.
