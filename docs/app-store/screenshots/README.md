# App Store Screenshots

Screenshots come from the native app in the iOS Simulator, not the web app.

## Sizes

| Folder | Device | Pixels | Status |
|---|---|---|---|
| `iphone-6.3/` | iPhone 18 Pro (iOS 27) | 1206 × 2622 | Required size ("Dynamic Island, medium"). App Store Connect scales it for other iPhones. |
| `ipad-13/` | iPad Pro 13-inch | 2064 × 2752 | Required because the app runs on iPad. |

PNG or JPEG, no alpha channel, up to 10 per size.

## How to capture

1. Use the iOS 27 simulators signed in as `e2e-test@gatherlists.com`. That account holds the demo data
   (six lists, six recipes, a week of meal plan, display name "Alex Morgan"). Sign in through
   "Sign In with Email" and type the account's password as the code.
2. Clean status bar:
   `xcrun simctl status_bar <udid> override --time "9:41" --batteryState discharging --batteryLevel 100 --wifiBars 3 --cellularBars 4`
3. Navigate to the screen, then `xcrun simctl io <udid> screenshot <file>.png`.
4. Dark mode: `xcrun simctl ui <udid> appearance dark` (the app's Appearance setting must be System).
5. Strip the alpha channel before uploading. `simctl` PNGs include one and App Store Connect rejects it.
6. `xcrun simctl status_bar <udid> clear` when done.

## Gotchas

- A meal plan entry of kind `recipe` shows the literal word "Recipe" unless its `title` is also set.
- Recipes without tags show an orange warning badge on the grid. The app auto-tags them the first time
  the Recipes tab loads, so open that tab once and relaunch before capturing.
- Grocery items with no store are grouped under "Unassigned". Assign a store for a cleaner header.
- The demo recipes have no photos, so the Recipes grid is not captured yet.
