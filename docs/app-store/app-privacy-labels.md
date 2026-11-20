# Gather Lists — App Privacy Labels

This file mirrors the App Privacy answers published in App Store Connect on
2026-11-20. When the app starts or stops collecting something, change the
answers in App Store Connect and update this file in the same change.

## Data types collected

Every type is linked to the user's identity and none is used for tracking.

| Section | Data type | Purposes | What it is in the app |
|---------|-----------|----------|-----------------------|
| Contact Info | Name | App Functionality | Display name on the account |
| Contact Info | Email Address | App Functionality | Sign-in and share invitations |
| User Content | Photos or Videos | App Functionality | Recipe and item photos saved to the account |
| User Content | Other User Content | App Functionality, Product Personalization | Lists, items, recipes, meal plans; past items and choices drive suggestions |
| Identifiers | Device ID | App Functionality | Push notification token (`device_tokens`) |
| Purchases | Purchase History | App Functionality | Subscription status (`subscriptions`) |
| Usage Data | Product Interaction | App Functionality | Counts of image lookups and recipe imports for the monthly limits (`api_usage_events`) |

Device ID and Product Interaction are cautious answers: a push token is not
strictly a device identifier, and the usage counts exist only to enforce limits.

## Data not collected

- Location, contacts, health and fitness, financial info, sensitive info
- Browsing history
- Search history (queries are passed on to fetch results and not saved)
- User ID (the account is identified by email, declared above)
- Diagnostics (no crash or performance reporting SDK)
- Advertising data and other usage data (no analytics SDK)

## Tracking

The app does not track users. No data is shared with advertisers or data brokers.

## Related compliance answers (App Compliance page)

- Security Assessment (China mainland): No
- AI Generated or Synthetic Content (China mainland): No. The only AI features
  use Apple's on-device model and are hidden where it is unavailable.
- Digital Services Act: non-trader (owner's decision, 2026-11-20)
