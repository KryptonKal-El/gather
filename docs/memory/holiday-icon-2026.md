# Holiday app icon + web logos (2026) — what changed and how to revert

The app icon is temporarily the Christmas version (Santa hat on the top
check-heart, snow caps on the other two, candy-cane list lines, snowflakes,
snow drift along the bottom). Applied 2026-11-09. The web wordmark logos
(login page, marketing homepage header, in-app header) carry the same
treatment minus the flakes/drift, which need the tile behind them.

## How it works

`scripts/generate-icons.js` takes a `--holiday` flag that swaps the icon-tile
sources and copies the season's wordmark logos into `public/logo/active/`,
the paths the web app references (`Login.jsx`, `App.jsx`,
`index-marketing.html` point at `/logo/active/<name>.svg`). Splash screens,
launch logos, and the iOS in-app logo are seasonal-invariant either way.

- Seasonal sources (checked in, keep): `public/logo/icon-only-full-bleed-holiday.svg`,
  `public/logo/icon-only-holiday.svg`, `public/logo/stacked-holiday.svg`,
  `public/logo/icon-name-dark-holiday.svg`, `public/logo/icon-name-tagline-holiday.svg`
- Original sources (checked in, untouched): `public/logo/icon-only-full-bleed.svg`,
  `public/logo/icon-only.svg`, `public/logo/stacked.svg`,
  `public/logo/icon-name-dark.svg`, `public/logo/icon-name-tagline.svg`

The holiday wordmark SVGs have a little extra viewBox headroom for the hat
(stacked: `0 -10 400 235`; dark: `0 -6 500 138`); layouts size them by width
with `height: auto`, so the few extra pixels are harmless.

## Files the flag regenerates (the complete list)

- `public/icon-64x64.png`, `public/icon-192x192.png`, `public/icon-512x512.png` (PWA)
- `public/apple-touch-icon.png`
- `public/icon.svg` (favicon — copied from the active rounded-tile SVG)
- `public/logo/active/stacked.svg`, `public/logo/active/icon-name-dark.svg`,
  `public/logo/active/icon-name-tagline.svg` (web wordmark logos — copied from
  the season's sources)
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
