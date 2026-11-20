# Gather Lists — App Store Metadata

The source of truth for the text on the App Store product page. When a
user-facing feature is added, changed, moved between Free and Pro, or removed,
update this file in the same change, then paste the new text into App Store
Connect with the next version. Promotional Text is the only field that can be
changed without submitting a version.

Last synced with App Store Connect: 2026-11-20 (version 1.0, build 144).

## App Name
Gather Lists

## Subtitle (30 chars max)
Grocery, recipes & meal plans

## Category
Primary: Food & Drink. Secondary: Productivity.

## Promotional Text (170 chars max)
Shared grocery lists that sort by store, a weekly meal plan built from your own recipes, and wish lists, guest lists and packing lists in one place.

## Keywords (100 chars max)
shopping,shared,planner,packing,todo,reminders,pantry,family,wish,gift,rsvp,guest,party,checklist

Don't repeat words from the app name or subtitle ("lists", "grocery",
"recipes", "meal", "plans"): Apple indexes those already.

## Description (4000 chars max)

Plain text only; the App Store does not render Markdown.

```text
Gather Lists keeps your grocery runs, meals and plans in one place, shared with the people you do them with.

GROCERY LISTS THAT ORGANIZE THEMSELVES
• Items sort into categories like produce and dairy as you add them
• Group by store, so each stop has its own list
• Search any list, add quantities, notes, prices and photos
• Suggestions from what you've bought before

SHARE WITH ANYONE
• Share a list with family or roommates and see changes as they happen
• Get notified when someone adds or checks off an item
• People you share with don't need to pay for anything

MORE THAN GROCERIES
• To-do lists with due dates and reminders
• Packing lists and project lists
• Guest lists that track RSVPs and head counts
• Wish lists with prices and priorities, where others can claim a gift without spoiling the surprise

RECIPES
• Save your own recipes or import one from a link
• Organize recipes into collections and share them
• Add a recipe's ingredients to a list in one tap

MEAL PLANNING (PRO)
• Plan breakfast, lunch and dinner for the week
• Let Gather suggest a balanced week from your own recipes
• Add the whole week's ingredients to your grocery list
• Cook mode walks you through a recipe one step at a time

EVERYWHERE YOU ARE
• iPhone and iPad, with home screen and lock screen widgets
• Also on the web at gatherlists.com
• Light and dark mode

PRIVATE BY DESIGN
Sign in with Apple, a passkey or an emailed code. No ads, no tracking, and your data is never sold.

GATHER LISTS PRO
Lists, sharing, reminders and saving recipes are free. Gather Lists Pro adds meal planning, online recipe search, cook mode and recipe tags.

• Monthly: $3.99 per month
• Annual: $24.99 per year
• Both start with a 1-week free trial

Payment is charged to your Apple Account at confirmation of purchase. Subscriptions renew automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel in your Apple Account settings.

Privacy Policy: https://gatherlists.com/privacy.html
Terms of Use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
```

### Rules for the description
- The "GATHER LISTS PRO" section is required by App Review for apps with
  subscriptions: what the subscription unlocks, each price and period, the
  trial, the renewal terms, and working links to the privacy policy and terms.
  Keep the prices in step with App Store Connect and `docs/memory/pro-gating.md`.
- The Free/Pro split described here is the launch state. It is only true once
  `pro_enforcement` is switched on.
- "No ads, no tracking" must agree with `app-privacy-labels.md`.
- Every bullet should be something a reviewer can find in the build submitted.

## Age Rating
4+ (every questionnaire answer is None or No).

## Content Rights
"Yes, this app has the necessary rights to its third-party content." The
third-party content is product photos from image search (Walmart, Open Food
Facts, Spoonacular, Google Images) and recipes from online recipe search
(Spoonacular). Revisit this answer if an image or recipe source is added.

## License Agreement
Apple's Standard License Agreement (the Terms of Use link in the description).

## Support URL
https://gatherlists.com/support

## Marketing URL
https://gatherlists.com

## Copyright
2026 Dorian Pineda

Year then owner; Apple adds the © symbol.

## App Review sign-in
Demo account `review@gatherlists.com`. It signs in by typing its password as the
sign-in code; no email is sent. Review Notes text:

```text
Gather Lists signs in with an emailed one-time code instead of a password. Because you cannot receive that email, the demo account below accepts a fixed sign-in code.

How to sign in:
1. Open the app, tap "Continue with Email" and enter: review@gatherlists.com
2. Tap "Email Me a Sign-In Code". No email is sent for this account.
3. On the next screen, type the fixed code into the "Sign-in code" field: [PASSWORD]
4. Tap "Sign In".

The fixed code contains letters, so that screen shows a full keyboard for this account. Please do not use "Sign in with Apple" or a passkey, as those would create a separate, empty account.

The Gather Lists Pro subscription is under Settings > Gather Lists Pro > Upgrade to Pro.

Account deletion is under Settings > Delete Account, at the bottom of the screen. Please do not delete the demo account while reviewing, as its sample data cannot be restored.
```

## What's New in This Version
Introducing Gather Lists: shared grocery lists that sort themselves, recipes, weekly meal planning, and lists for packing, guests, wishes and to-dos. Available on iPhone and iPad.
