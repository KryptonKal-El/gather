# App Store creative assets

Looping videos for the two optional creative slots in App Store Connect (iOS 27+).

| File | Slot | Size | Art safe area |
|---|---|---|---|
| `product-page-header.mov` | Product page header | 3840 × 1646 (21:9) | 1646 × 661 at (1097, 493) |
| `search-results.mov` | Search results | 3840 × 2560 (3:2) | 2168 × 1030 at (836, 765) |

Both are 8 seconds, 30 fps, H.264, no audio. The first and last frames match, so they loop cleanly.

## Re-rendering

`scene.html` draws both layouts (`?asset=header` or `?asset=search`). Open it in a browser to watch it play.

1. `node render-frames.mjs header <frames-dir>` writes 240 PNG frames with Playwright.
2. `swift encode.swift <frames-dir> product-page-header.mov 30` encodes them. There is no ffmpeg on this
   machine, so the encoder uses AVFoundation.

Use `search` and `search-results.mov` for the other asset.

The phone screens come from `../screenshots/iphone-6.3/`. Retake those first if the app's look changes.
