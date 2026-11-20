# App Store Screenshots

Screenshots come from the native app in the iOS Simulator, not the web app.

## Sizes

| Folder | Device | Pixels | Status |
|---|---|---|---|
| `iphone-6.3/` | iPhone 18 Pro (iOS 27) | 1206 × 2622 | Required size ("Dynamic Island, medium"). App Store Connect scales it for other iPhones. |
| `ipad-13/` | iPad Pro 13-inch | 2064 × 2752 | Required because the app runs on iPad. |
| `iphone-duo/` | iPhone Duo, open (iOS 27.2) | 2853 × 2007 | Optional slot for the foldable's inner screen. |

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

### iPhone Duo

- The Duo simulator needs an iOS 27.1+ runtime (`xcodebuild -downloadPlatform iOS`).
- Open the hinge first (Simulator hinge control, or the simulator tool's `duo_pose open`).
- It has two displays, so `simctl io` needs one named: `--display=3` is the inner screen,
  `--display=1` the outer (1398 × 2034). Check with `xcrun simctl io <udid> screenshot x.png`,
  which lists them.

## Gotchas

- The demo account is on the Pro limits tester list (`docs/memory/pro-gating.md`), so the meal plan and
  recipe screens show lock notices. Take it off `pro_enforcement_testers` for the shoot and put it back after.
- The simulator panel shows one device at a time, so each simulator needs its own sign-in.
- Relaunching the app reopens the last list. Check where each device is before capturing.

- A meal plan entry of kind `recipe` shows the literal word "Recipe" unless its `title` is also set.
- Recipes without tags show an orange warning badge on the grid. The app auto-tags them the first time
  the Recipes tab loads, so open that tab once and relaunch before capturing.
- Grocery items with no store are grouped under "Unassigned". Assign a store for a cleaner header.
- The demo recipes have no photos, so the Recipes grid is not captured yet.
