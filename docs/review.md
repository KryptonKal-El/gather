# Critic Review — US-008 (App Store Metadata and Privacy Policy)

**PRD:** prd-ios-app-store  
**Story Reviewed:** US-008  
**Review Date:** 2026-03-03  
**Reviewer:** Critic Agent

---

## Summary

This review covers the App Store submission materials for ShoppingListAI:
- App Store metadata (`metadata.md`)
- Privacy policy (`privacy-policy.md`, `privacy.html`)
- App Privacy labels (`app-privacy-labels.md`)
- Apple Privacy Manifest (`PrivacyInfo.xcprivacy`)

The implementation is **well-structured** with comprehensive coverage. There are **2 critical issues**, **3 important issues**, and **2 minor issues** to address before App Store submission.

---

## Critical Issues

### CRITICAL-1: Missing Walmart API disclosure in privacy policy and third-party services

**Files:** `docs/app-store/privacy-policy.md`, `public/privacy.html`  
**Lines:** 54-57 (privacy-policy.md), 166-169 (privacy.html)

**Description:** The privacy policy lists Open Food Facts and SerpAPI as third-party services but omits **Walmart Affiliate API**, which is explicitly listed in `project.json` as the *primary* product image search provider. Per Apple's guidelines and FTC requirements, all third-party services that receive user data must be disclosed.

**Impact:** App Store rejection risk; FTC compliance issue; user trust.

**Fix:** Add Walmart to the Third-Party Services section:
```markdown
- **Walmart Affiliate API** — Primary product image search (search queries only, no personal data)
- **Open Food Facts** — Secondary product data lookup (open-source, no personal data sent)
- **SerpAPI** — Tertiary fallback product image search (search queries only, no personal data)
```

---

### CRITICAL-2: PrivacyInfo.xcprivacy missing FileTimestamp API declaration (Capacitor usage)

**File:** `ios/App/App/PrivacyInfo.xcprivacy`  
**Lines:** 56-65

**Description:** The privacy manifest declares `NSPrivacyAccessedAPICategoryUserDefaults` with reason `CA92.1`, which is correct. However, Capacitor apps typically also access the **File Timestamp API** (`NSPrivacyAccessedAPICategoryFileTimestamp`) for file operations. Starting May 1, 2024, Apple rejects apps that use required-reason APIs without proper declaration.

**Recommendation:** Audit Capacitor plugins for API usage. Run this check:
```bash
grep -r "fileModificationDate\|attributesOfItem\|NSFileModificationDate" ios/
```

If any file timestamp access is found (common in filesystem plugins), add:
```xml
<dict>
    <key>NSPrivacyAccessedAPIType</key>
    <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
    <key>NSPrivacyAccessedAPITypeReasons</key>
    <array>
        <string>C617.1</string>
    </array>
</dict>
```

**Impact:** App Store rejection if APIs are used without declaration.

---

## Important Issues

### IMPORTANT-1: Privacy policy missing email/contact for GDPR compliance

**Files:** `docs/app-store/privacy-policy.md`, `public/privacy.html`  
**Lines:** 80-84 (privacy-policy.md)

**Description:** GDPR requires a specific contact method for data subject requests. The policy provides a website URL and in-app path, but Apple and GDPR guidelines recommend including an email address for privacy inquiries.

**Impact:** Weak compliance posture; user friction for data requests.

**Fix:** Add dedicated email:
```markdown
## Contact Us

For privacy-related questions or data deletion requests:
- Email: privacy@shoppinglistai.app
- Website: https://shoppinglistai.vercel.app
- In-app: Settings > Support
```

---

### IMPORTANT-2: App Privacy Labels missing "Account Management" purpose for Email/Name

**File:** `ios/App/App/PrivacyInfo.xcprivacy`  
**Lines:** 6-30

**Description:** The privacy manifest only declares `NSPrivacyCollectedDataTypePurposeAppFunctionality` for Email and Name. However, `app-privacy-labels.md` correctly lists both "App Functionality" AND "Account Management" as purposes. These must match.

Per Apple's guidelines, Email collected via Sign in with Apple should include both purposes.

**Fix:** Update PrivacyInfo.xcprivacy:
```xml
<key>NSPrivacyCollectedDataTypePurposes</key>
<array>
    <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
    <string>NSPrivacyCollectedDataTypePurposeAccountCreation</string>
</array>
```

Apply this to both EmailAddress and Name data type entries.

---

### IMPORTANT-3: Keywords exceed 100 character limit

**File:** `docs/app-store/metadata.md`  
**Line:** 13

**Description:** The keywords string is:
```
shopping list,grocery,AI,shared lists,recipes,meal planning,food,kitchen,smart list,family
```
This is **96 characters** — within limit, but barely. However, "smart list" is not a common search term and uses 10 chars. Consider optimizing for higher-value keywords.

**Recommendation:** Replace low-value keywords:
```
shopping list,grocery,AI,shared lists,recipes,meal planning,food,sync,organize,checklist
```
(93 chars, adds "sync", "organize", "checklist" — common App Store searches)

---

## Minor Issues

### MINOR-1: Marketing URL and Support URL are identical

**File:** `docs/app-store/metadata.md`  
**Lines:** 51-55

**Description:** Both URLs point to `https://shoppinglistai.vercel.app`. Apple allows this, but having a dedicated `/support` or `/help` page is better UX and demonstrates app maturity.

**Fix (optional):** Create `/support.html` with FAQ/contact form, or append `#support` anchor.

---

### MINOR-2: Copyright year is 2026 — verify this is intentional

**File:** `docs/app-store/metadata.md`  
**Line:** 58

**Description:** Copyright shows `© 2026 ShoppingListAI`. If the app is being submitted in 2026, this is correct. If submitted earlier, update to current year.

**Impact:** None if correct; looks odd if wrong.

---

## What's Done Well

1. **Comprehensive privacy policy** — Covers all App Store required sections: data collection, usage, sharing, storage, deletion, children's privacy, and third-party services (minus Walmart).

2. **Privacy manifest structure correct** — `NSPrivacyTracking: false`, empty `NSPrivacyTrackingDomains`, and `NSPrivacyCollectedDataTypeTracking: false` on all data types align with "no tracking" claim.

3. **UserDefaults API reason correct** — `CA92.1` ("Access info from same app") is the appropriate reason for Capacitor's use of UserDefaults for app state.

4. **Photos marked as not linked to identity** — Correctly reflects that product photos are processed but not stored or associated with user accounts.

5. **Privacy labels match policy** — The data types in `app-privacy-labels.md` (Email, Name, Photos, Other User Content) match what's declared in the privacy policy and xcprivacy manifest.

6. **HTML privacy page well-styled** — Responsive design, accessible, matches app branding (green theme), proper semantic HTML.

7. **Apple Sign-In private relay mentioned** — Privacy policy correctly notes users can use Apple's private relay email.

8. **"What's New" version text is appropriate** — Clear, concise initial release message.

9. **Category selection appropriate** — "Food & Drink" is correct for a grocery/shopping list app.

10. **App description covers key features** — AI image search, real-time sharing, cross-device sync, privacy-first messaging all present.

---

## Requirements Traceability

| Requirement | Status | Notes |
|-------------|--------|-------|
| App Store metadata complete | **Pass** | Name, subtitle, description, keywords, category all present |
| Privacy policy covers collection | **Partial** | Missing Walmart API disclosure |
| Privacy policy covers deletion rights | **Pass** | Clear deletion instructions provided |
| App Privacy labels accurate | **Pass** | Matches actual app data collection |
| PrivacyInfo.xcprivacy valid | **Partial** | May need FileTimestamp API; purposes incomplete |
| HTML privacy page accessible | **Pass** | /privacy.html works standalone |
| No tracking declaration | **Pass** | NSPrivacyTracking: false correctly set |

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 2 |
| Important | 3 |
| Minor | 2 |
| Positive | 10 |

---

## Action Items

### Must Fix Before App Store Submission

| Issue | Effort | Owner |
|-------|--------|-------|
| CRITICAL-1: Add Walmart to privacy policy | Low | Both MD and HTML files |
| CRITICAL-2: Audit Capacitor for FileTimestamp API | Medium | Run grep, update xcprivacy |
| IMPORTANT-2: Add AccountCreation purpose | Low | xcprivacy file |

### Should Fix

| Issue | Effort |
|-------|--------|
| IMPORTANT-1: Add privacy email | Low |
| IMPORTANT-3: Optimize keywords | Low |
| MINOR-1: Separate support URL | Low |

---

## Verdict

**CONDITIONAL PASS** — Fix CRITICAL-1 and CRITICAL-2 before submission. The privacy policy is well-written but incomplete, and the privacy manifest may be missing required API declarations that would cause rejection.
