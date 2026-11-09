# Holiday app icon (2026) — what changed and how to revert

The app icon is temporarily the Christmas version (Santa hat on the top
check-heart, snow caps on the other two, candy-cane list lines, snowflakes,
snow drift along the bottom). Applied 2026-11-09.

## How it works

`scripts/generate-icons.js` takes a `--holiday` flag that swaps only the
icon-tile sources; the wordmark logos, splash screens, and launch logos are
seasonal-invariant and untouched either way.

- Seasonal sources (checked in, keep): `public/logo/icon-only-full-bleed-holiday.svg`,
  `public/logo/icon-only-holiday.svg`
- Original sources (checked in, untouched): `public/logo/icon-only-full-bleed.svg`,
  `public/logo/icon-only.svg`

## Files the flag regenerates (the complete list)

- `public/icon-64x64.png`, `public/icon-192x192.png`, `public/icon-512x512.png` (PWA)
- `public/apple-touch-icon.png`
- `public/icon.svg` (favicon — copied from the active rounded-tile SVG)
- `assets/icon-only.png`, `assets/icon-foreground.png`
- `ios-native/GatherLists/GatherLists/Assets.xcassets/AppIcon.appiconset/icon-foreground.png`

## To revert after the holidays

```bash
node scripts/generate-icons.js
```

then commit the regenerated files above (suggested message:
`chore(brand): restore regular app icon after the holidays`), push (web icons
deploy via Vercel), and ship a TestFlight/App Store build so the iOS icon
reverts too. Nothing else to undo.
