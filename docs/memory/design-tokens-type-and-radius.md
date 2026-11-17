# Type and radius tokens (web)

## Rule
Font sizes and corner radii in `src/**/*.css` come from the tokens in `src/index.css`, not raw values:

- `--font-2xs` 0.7rem, `--font-xs` 0.75rem, `--font-sm` 0.85rem, `--font-md` 0.95rem, `--font-base` 1rem,
  `--font-lg` 1.1rem, `--font-xl` 1.25rem, `--font-2xl` 1.5rem, `--font-3xl` 1.75rem
- `--radius-sm` 4px, `--radius-md` 8px, `--radius-lg` 12px, `--radius-xl` 16px, `--radius-pill` 999px

## Deliberate exceptions
- `font-size: 16px` stays a literal wherever it appears. It is the iOS "no zoom on focus" floor for inputs
  and must not depend on a token someone might retune.
- `border-radius: 50%` for circles, and the three display sizes (`3rem` empty-state icons, `36px` cook-mode timer).
- `public/*.html` (landing, support, privacy) are standalone pages and do not load `index.css`.

## Why
Before 2026-11-17 the app had about 40 font sizes and 20 radii that differed by fractions of a pixel.

## Checking a sweeping CSS change
Screenshot every screen before and after with Playwright signed in through `e2e/testAccount.js`, and compare
per-screen counts of elements whose `scrollWidth > clientWidth` plus page horizontal overflow. That catches
new truncation without eyeballing every image.

Text links use `--primary`. `--accent` (pale pink) is for fills and decoration only; as text on white it is unreadable.
