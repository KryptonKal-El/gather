# App Store Screenshots Guide

## Required Sizes

| Device Class | Resolution | Required |
|---|---|---|
| 6.7" iPhone | 1290 × 2796 | ✅ Yes (primary) |
| 6.5" iPhone | 1284 × 2778 | ✅ Yes |  
| 12.9" iPad Pro | 2048 × 2732 | ✅ Yes (for universal app) |

## Recommended Screenshots (5-6 per device)

1. **Shopping List** — Main list view with items
2. **AI Image Search** — Camera/search feature in action
3. **Shared List** — Collaborative list with avatars
4. **Dark Mode** — List view in dark mode
5. **Recipe Panel** — Recipe suggestions panel open

## Capture Methods

### Method 1: Playwright Script (Web-Based)
Run `node scripts/capture-screenshots.js` with the dev server running on port 5173.
This captures the web version at exact device resolutions.

### Method 2: Xcode Simulator (Recommended for Final)
1. Open project: `npm run cap:ios`
2. Select device in Xcode (iPhone 15 Pro Max, iPad Pro 12.9")
3. Build & Run (Cmd+R)
4. Navigate to desired screen
5. Capture: Cmd+S in Simulator or `xcrun simctl io booted screenshot filename.png`

### Method 3: Physical Device
Use QuickTime Player > File > New Movie Recording with an iOS device connected.

## Notes
- Screenshots must include the status bar
- Use a realistic time (e.g., 9:41 AM — Apple's standard)
- Ensure good sample data is visible in lists
- Both light and dark mode shots recommended
