# PRD: Marketing Site Redesign

**ID:** prd-marketing-site-redesign  
**Status:** draft  
**Created:** 2026-06-03  

---

## Overview

Redesign `public/index-marketing.html` to a modern, bold app-marketing page inspired by withnovu.com. Replace the current basic hero + card grid with a polished layout: sticky nav with a prominent "Launch App" CTA, a full-bleed hero with the App Store badge and a phone screenshot, Novu-style alternating feature rows, a bottom CTA section, and a cleaner footer. No JavaScript — static HTML + inline CSS only.

---

## Goals

- Make the page feel like a real app marketing site, not a placeholder.
- Surface the "Launch App" sign-in entry point immediately in the nav — not buried in the footer.
- Communicate Gather Lists' core value props quickly and memorably.
- Keep the page static (no `<script>` tags) and self-contained (inline CSS).

---

## Non-Goals

- No React or Vite involvement — this is a static HTML file in `public/`.
- No new pages (support, privacy, etc.) — only `index-marketing.html` is in scope.
- No animations or JavaScript.
- No new image assets beyond `/marketing/app-screenshot.png` (user-supplied).

---

## Locked Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | Design direction | Bold & modern — large typography, brand green `#3D7A63`, soft gradient accents |
| 2 | Sign In CTA placement | Header only — sticky nav "Launch App" button links to `/app` |
| 3 | Hero content | Logo + tagline + App Store badge + phone screenshot (`/marketing/app-screenshot.png`) |
| 4 | Screenshot asset | Spec `/marketing/app-screenshot.png`; user will supply the image |
| 5 | Feature section | Replace 2×2 grid with Novu-style alternating feature rows |
| 6 | Feature row topics | Smart Lists, Real-Time Sharing, Recipes & Meal Planning, Works Everywhere — reframed in punchy 2-line copy |

---

## Page Structure

```
<header>   Sticky nav — logo left, nav links center, "Launch App" button right
<main>
  <section .hero>       Full-bleed hero — tagline, subline, App Store badge, phone screenshot
  <section .features>   4 alternating feature rows (text left/right, image opposite)
  <section .cta>        Bottom full-bleed CTA — tagline + App Store badge
</main>
<footer>   Support · Privacy Policy · © 2026 Gather Lists
```

---

## User Stories

---

### S-01 — Sticky Navigation Bar

**Priority:** High

**Description:**  
Replace the current `<header class="hero">` with a proper sticky nav bar. The nav contains the Gather Lists logo on the left, anchor links to `#features` in the center, and a "Launch App" button on the right that links to `/app`.

**Acceptance Criteria:**
- `<header>` contains a `<nav>` element.
- Logo (`/logo/stacked.svg`) is displayed on the left, max-height 36px.
- Nav link "Features" anchors to `#features`.
- "Launch App" button links to `/app`, styled with brand green background (`#3D7A63`), white text, rounded corners, visible on all screen sizes.
- Header is `position: sticky; top: 0` with a solid background and a subtle bottom border or shadow so it reads over the hero.
- On mobile (≤ 600px): nav links are hidden; logo and "Launch App" button remain visible.
- No `<script>` tags anywhere in the file.
- `npm test` passes (all existing marketing-page tests pass; new tests added for nav elements).

**Flow Chart:**
```
1. public/index-marketing.html
   ├─ Replace <header class="hero"> with <header class="site-header">
   ├─ Add <nav> inside header
   ├─ Add logo <img> (left), nav links (center), "Launch App" <a> button (right)
   ├─ Add .site-header CSS: position sticky, background, shadow, z-index
   ├─ Add .nav-logo, .nav-links, .nav-cta CSS
   └─ Add @media (max-width: 600px): hide .nav-links

2. src/__tests__/marketing-page.test.js
   ├─ Add test: contains <nav> element
   ├─ Add test: contains "Launch App" link to /app in header
   └─ Add test: contains sticky header CSS

3. VERIFY QUALITY
   ├─ Run lint (n/a — static HTML; verify no <script> tags)
   └─ Run npm test
```

---

### S-02 — Full-Bleed Hero Section

**Priority:** High

**Description:**  
Replace the current hero (which was the `<header>`) with a dedicated `<section class="hero">` inside `<main>`. The hero uses a dark background with a large 2-line headline, a short subline, the App Store badge, and a phone screenshot image on the right (desktop) / below (mobile).

**Acceptance Criteria:**
- Hero is a `<section>` inside `<main>`, not the `<header>`.
- Background: dark (`#0f0f0f` or a dark gradient from `#0f0f0f` to `#1a2e24`) spanning full viewport width.
- Headline: large (≥ 48px desktop, ≥ 32px mobile), bold, white, two lines max. Copy: **"Every list,\nin one place."**
- Subline: 18px, light grey (`#aaa`), below headline. Copy: **"Groceries, meals, sharing — all synced in real time on web and iOS."**
- App Store badge link to `https://apps.apple.com/app/id6760205400` present below subline.
- Phone screenshot `<img src="/marketing/app-screenshot.png" alt="Gather Lists app screenshot">` displayed to the right of the text column on desktop; stacked below on mobile.
- Hero layout: two-column flex on desktop (text left, image right), single column on mobile.
- `apple-itunes-app` meta tag retained in `<head>` (existing test must still pass).
- `npm test` passes.

**Flow Chart:**
```
1. public/index-marketing.html
   ├─ Add <section class="hero"> inside <main> (above features)
   ├─ Add .hero-content (text column): headline, subline, App Store badge
   ├─ Add .hero-image (image column): <img src="/marketing/app-screenshot.png">
   ├─ Add .hero CSS: dark background, two-column flex, min-height
   ├─ Add .hero h1 CSS: large font-size, white, bold
   ├─ Add .hero p CSS: subline color and size
   └─ Add @media (max-width: 600px): single column, image below text

2. src/__tests__/marketing-page.test.js
   ├─ Add test: contains hero section with dark background CSS
   ├─ Add test: contains /marketing/app-screenshot.png img
   └─ Add test: hero headline text present

3. VERIFY QUALITY
   ├─ Run lint (verify no <script> tags)
   └─ Run npm test
```

---

### S-03 — Alternating Feature Rows

**Priority:** High

**Description:**  
Replace the 2×2 feature card grid with 4 Novu-style alternating rows. Each row has a short punchy headline (2 lines, italic key word), a 1–2 sentence description, and an emoji icon. Rows alternate text-left/text-right layout on desktop; stack single-column on mobile. The section has `id="features"` so the nav anchor works.

**Feature row copy:**

| # | Headline | Description |
|---|----------|-------------|
| 1 | "Every kind of *list.*" | Groceries, packing lists, party supplies — one app handles them all, exactly the way you need. |
| 2 | "Shared in *real time.*" | Add an item and it appears on everyone's list instantly. No refreshing, no waiting. |
| 3 | "Meals into *lists.*" | Save recipes, plan the week, and send ingredients straight to your grocery list in one tap. |
| 4 | "Web, iOS, *everywhere.*" | Open it in the browser or on your iPhone. Everything stays in sync across every device. |

**Acceptance Criteria:**
- `<section id="features">` replaces the old `<main class="features">`.
- 4 `.feature-row` elements, alternating `.row-reverse` class on even rows.
- Each row: `.row-text` (headline + description) and `.row-icon` (large emoji, ≥ 80px).
- Headlines: ≥ 28px, bold, dark (`#111`), with `<em>` on the italic key word styled in brand green `#3D7A63`.
- Descriptions: 16px, `#555`.
- Desktop: two-column flex, 50/50 split, rows alternate direction.
- Mobile: single column, icon above text.
- Old feature card tests (`Smart Lists`, `Real-Time Sharing`, `Recipes & Meal Planning`, `Works Everywhere`) updated in the test file to match new copy.
- `npm test` passes.

**Flow Chart:**
```
1. public/index-marketing.html
   ├─ Replace <main class="features"> with <section id="features">
   ├─ Add 4 .feature-row elements with .row-reverse on rows 2 and 4
   ├─ Each row: .row-text (h2 with <em>, p) and .row-icon (emoji span)
   ├─ Add .feature-row CSS: flex, align-center, gap, padding
   ├─ Add .row-reverse CSS: flex-direction row-reverse
   ├─ Add h2 em CSS: color #3D7A63, font-style italic
   └─ Add @media (max-width: 600px): flex-direction column, icon above text

2. src/__tests__/marketing-page.test.js
   ├─ Update "Smart Lists" test → match "Every kind of" or new copy
   ├─ Update "Real-Time Sharing" test → match "Shared in real time" copy
   ├─ Update "Recipes & Meal Planning" test → match "Meals into lists" copy
   ├─ Update "Works Everywhere" test → match "Web, iOS, everywhere" copy
   └─ Add test: contains id="features"

3. VERIFY QUALITY
   ├─ Run lint (verify no <script> tags)
   └─ Run npm test
```

---

### S-04 — Bottom CTA Section

**Priority:** Medium

**Description:**  
Add a full-bleed CTA section above the footer, matching the Novu pattern. Dark background, large headline, short line, and the App Store badge.

**Acceptance Criteria:**
- `<section class="cta-section">` present above `<footer>`.
- Background: brand green `#3D7A63` (or a dark green gradient).
- Headline: white, ≥ 32px. Copy: **"Start your lists today."**
- Subline: white/light, 18px. Copy: **"Free on web and iOS."**
- App Store badge link to `https://apps.apple.com/app/id6760205400`.
- `npm test` passes.

**Flow Chart:**
```
1. public/index-marketing.html
   ├─ Add <section class="cta-section"> above <footer>
   ├─ Add headline, subline, App Store badge inside section
   └─ Add .cta-section CSS: brand green background, centered, padding

2. src/__tests__/marketing-page.test.js
   └─ Add test: contains "Start your lists today" CTA text

3. VERIFY QUALITY
   ├─ Run lint (verify no <script> tags)
   └─ Run npm test
```

---

### S-05 — Footer Cleanup

**Priority:** Low

**Description:**  
Restyle the footer to match the new design. Keep existing links (Support, Privacy Policy) and copyright. Remove the "App" footer link — it is superseded by the sticky nav "Launch App" button.

**Acceptance Criteria:**
- `<footer>` retained with Support and Privacy Policy links.
- **"App" link (`<a href="/app">`) removed** from the footer.
- Copyright line updated if needed: `© 2026 Gather Lists`.
- Brand color `#3D7A63` used on footer links (existing test passes).
- Footer styled: dark background (`#0f0f0f` or similar), white or light-grey link text.
- Existing tests for support link, privacy link, copyright, and brand color still pass.
- `npm test` passes.

**Flow Chart:**
```
1. public/index-marketing.html
   ├─ Remove <a href="/app">App</a> from footer
   ├─ Restyle .footer CSS: background, typography, link colors
   └─ Ensure © 2026 Gather Lists copyright retained

2. src/__tests__/marketing-page.test.js
   ├─ Remove or update "contains app footer link" test → assert <a href="/app"> exists in <header> (not footer)
   └─ Verify support, privacy, copyright tests still pass

3. VERIFY QUALITY
   ├─ Run lint (verify no <script> tags)
   └─ Run npm test
```

---

## Test File Impact

`src/__tests__/marketing-page.test.js` requires updates across multiple stories. The Builder should coordinate all test changes in a single pass after all HTML stories are complete, or story by story as each section is implemented. Either approach is acceptable — Builder's discretion.

---

## Out of Scope

- `/support` page content.
- `/privacy.html` content.
- React components or Vite build pipeline.
- Dark mode variant.
- Animations or scroll effects.
