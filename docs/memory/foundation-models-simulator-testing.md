# Testing FoundationModels (on-device recipe import) without a device

## Problem

Recipe import runs on Apple's on-device model (`RecipeTextParseService` in
`RecipeSearchService.swift`). On a simulator whose iOS runtime is OLDER than the
host macOS (e.g. iOS 26.3 sim on macOS 27), `SystemLanguageModel.default.isAvailable`
is `true` — so "Import from Text" shows — but every `respond` call fails at once.
The device log shows:

```
InferenceError::inferenceFailed::...PrompteTemplateError.promptTemplateNotFound
(model com.apple.fm.language.instruct_300m.safety)
```

The simulator borrows the host Mac's model, and the older runtime can't drive the
newer model's safety template. It is an environment mismatch, not an app bug. The
app correctly shows its "Couldn't Import" alert.

## Workaround

- Use a simulator runtime that matches the host OS (iOS 27 sim on macOS 27). It is
  a fresh device, so it needs a manual sign-in first.
- Or test the parser headlessly on the Mac: copy everything from
  `/// A recipe parsed from freeform text` to the end of `RecipeSearchService.swift`
  into a `main.swift` with a small `@main` that calls
  `RecipeTextParseService.parse(text:)`, then
  `xcrun swiftc -parse-as-library -target arm64-apple-macos27.0 main.swift`.
  The `@Generable` macros compile fine from the command line. This exercises the
  real model, the token pre-check (`tooLong`), and the non-recipe path (`failed`).

## Reading the failure

`print()` output isn't in the unified log. Use:

```bash
xcrun simctl spawn <udid> log show --last 3m --style compact \
  --predicate 'process == "GatherLists" AND subsystem CONTAINS[c] "modelmanager"'
```

## Prompt notes

The ~3B model needs worked examples to split quantity from name; descriptions alone
made it put the whole line in `quantity`. Greedy sampling keeps output stable. It
still slips on count-only lines ("1 egg, beaten"), which is why the review form
stays in the flow.
