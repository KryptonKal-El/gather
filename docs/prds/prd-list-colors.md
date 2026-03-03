# PRD: List Colors

**Status:** Ready  
**Created:** 2026-03-02  
**Author:** Planner  

## Summary

Add a color property to shopping lists so users can visually distinguish them at a glance. Each list gets a required color (with a sensible default) displayed as a subtle background tint on the list row. The color picker follows the same swatch pattern used for stores and categories, with a curated set of 10 colors.

## Motivation

Users with multiple lists (e.g., "Groceries", "Costco", "Party Supplies") need to quickly differentiate them. Emojis help, but a color tint on each list row provides instant visual grouping — especially when scanning a long list of lists. This mirrors the color system already in place for stores and categories.

## Scope

### In Scope
- Add a `color` column to the `lists` table in Supabase (text, NOT NULL, with default)
- Curate a set of 10 preset colors for lists
- Add a color swatch picker to the list **create** form (in `ListSelector`)
- Add a color swatch picker to the list **edit** form (in `ListSelector`)
- Display the selected color as a subtle background tint on each list row
- Pass color through the full data flow: database → service layer → context → UI
- Rename the three-dot menu option from "Name & Icon" to "Name, Icon & Color" (both desktop dropdown and mobile action sheet)

### Out of Scope
- Free-form / custom color input (hex entry, color wheel)
- Color for shared lists displayed differently than owned lists
- Extracting a reusable `<ColorPicker>` component (nice-to-have, not required — inline is fine, matching the existing StoreManager pattern)

## Preset Colors (10)

A curated, balanced set of 10 colors that provide good contrast and visual variety in both light and dark mode:

| # | Hex | Name |
|---|-----|------|
| 1 | `#1565c0` | Blue |
| 2 | `#2e7d32` | Green |
| 3 | `#c62828` | Red |
| 4 | `#ef6c00` | Orange |
| 5 | `#6a1b9a` | Purple |
| 6 | `#00838f` | Teal |
| 7 | `#ad1457` | Pink |
| 8 | `#f9a825` | Yellow |
| 9 | `#37474f` | Slate |
| 10 | `#4e342e` | Brown |

**Default color:** `#1565c0` (Blue) — assigned when a list is created without an explicit selection, and used as the pre-selected swatch in the create form.

---

## User Stories

### US-001: Database Migration — Add `color` column to `lists`

**As a** developer  
**I want** a `color` column on the `lists` table  
**So that** each list can store its associated color  

#### Details

- Add a new Supabase migration file: `supabase/migrations/YYYYMMDDHHMMSS_add_list_color.sql`
- SQL: `ALTER TABLE lists ADD COLUMN color text NOT NULL DEFAULT '#1565c0';`
- The `NOT NULL DEFAULT` ensures existing lists get a color automatically (blue)
- No RLS changes needed — the `color` column is covered by existing row-level policies on `lists`
- Run the migration against the remote Supabase project after local testing

#### Acceptance Criteria

- [ ] Migration file exists and applies cleanly (`supabase db push` or `supabase migration up`)
- [ ] Existing lists in the database have `color = '#1565c0'` after migration
- [ ] New lists inserted without a `color` value default to `'#1565c0'`
- [ ] No RLS policy errors — existing CRUD operations on lists still work

---

### US-002: Service Layer & Context — Wire `color` through data flow

**As a** developer  
**I want** the `color` field passed through create, update, subscribe, and optimistic update flows  
**So that** the UI can read and write list colors  

#### Details

**database.js changes:**
- `createList()` (lines 20-38): Add `color` parameter, include in INSERT. Default to `'#1565c0'` if not provided.
- `updateList()` (lines 46-64): Add `color` to the allowed update mappings (like `name` and `emoji`).
- `subscribeLists()` (lines 111-167): Include `color` in the returned list objects from the re-fetch query mapping.

**ShoppingListContext.jsx changes:**
- `createListAction` (line 191): Accept `color` parameter, pass to `dbCreateList`, include in the optimistic state update object.
- `updateListDetailsAction` (line 218): Allow `color` in the `updates` object (add to `allowed` mapping).
- Ensure `subscribeLists` callback propagates `color` into the `lists` state.

#### Acceptance Criteria

- [ ] `createList('userId', 'Groceries', 'email', '🛒', '#2e7d32')` creates a list with `color = '#2e7d32'` in the database
- [ ] `updateList('ownerId', 'listId', { color: '#c62828' })` updates the color in the database
- [ ] `subscribeLists` returns list objects that include the `color` property
- [ ] Optimistic update in `createListAction` includes the `color` field
- [ ] Omitting `color` in `createList` defaults to `'#1565c0'`
- [ ] Lint passes

---

### US-003: Color Picker in Create & Edit Forms

**As a** user  
**I want** to choose a color when creating or editing a list  
**So that** I can visually distinguish my lists  

#### Details

**Create form** (`ListSelector.jsx` lines 259-276):
- Add a row of 10 color swatches below the name input (above the Create button)
- Default selection: `#1565c0` (Blue) — first swatch is pre-selected
- Pass the selected color to `onCreate(name, emoji, color)`
- Swatch styling: reuse the same visual pattern as StoreManager (circular buttons, 1.5rem diameter, selected state with border + slight scale)

**Edit form** (`ListSelector.jsx` lines 91-119):
- Add the same color swatch row below the EmojiPicker + name input row
- Pre-select the list's current color
- Pass the updated color in `onUpdateDetails(id, { name, emoji, color })`

**Rename menu option:**
- Desktop dropdown (line 156): Change "Name & Icon" → "Name, Icon & Color"
- Mobile action sheet (line 199): Change "Name & Icon" → "Name, Icon & Color"

**CSS** (`ListSelector.module.css`):
- Add `.colorPicker`, `.colorSwatch`, `.colorSelected` styles (can be scoped to this module, matching StoreManager's visual pattern)
- Responsive: on mobile, ensure swatches have adequate touch targets (min 36px tap area with spacing)

**Preset colors constant:**
- Define `LIST_PRESET_COLORS` array at the top of `ListSelector.jsx` (10 hex values from the table above)

#### Acceptance Criteria

- [ ] Create form shows 10 color swatches; Blue is pre-selected by default
- [ ] Tapping a swatch selects it (visual feedback: border + scale)
- [ ] The selected color is passed through to `onCreate`
- [ ] Edit form shows the same swatches with the list's current color pre-selected
- [ ] Changing color in edit form and saving persists the new color
- [ ] Menu option text reads "Name, Icon & Color" on both desktop and mobile
- [ ] Swatches are usable on mobile (adequate touch targets)
- [ ] Works in both light and dark mode
- [ ] Lint passes

---

### US-004: Display List Color as Full Row Background

**As a** user  
**I want** to see my list's color as the row background  
**So that** I can instantly identify lists by color  

#### Details

**Current state (to be changed):**
- `getRowTintStyle` in `ListSelector.jsx` (line 90-93) appends `'1A'` (10% alpha) to the hex color — this produces a washed-out tint that doesn't match the selected color. Remove this approach entirely.

**New approach — full color background with white text:**

**`getRowTintStyle` replacement** (`ListSelector.jsx`):
- Apply `backgroundColor: list.color` at full opacity (no alpha suffix)
- Set `color: '#fff'` on the row so all text (list name, item count, chevron, menu button) is white and readable against the colored background
- Apply to ALL list rows (owned + shared), including when active
- Remove the `isActive` skip — colored rows should always show their color. The active state can be indicated by a subtle brightness change (e.g., a `filter: brightness(1.15)` or a thin white left border) instead of the `--primary-tint` background.

**Text color overrides** (`ListSelector.jsx` inline styles or CSS):
- `.listName` — white (`#fff`)
- `.listCount` — white at reduced opacity (`rgba(255,255,255,0.7)`) for visual hierarchy
- `.chevron` — white (`#fff`)
- `.menuBtn` — white (`#fff`), including hover state
- `.sharedBadge` — white text on `rgba(255,255,255,0.2)` background (semi-transparent white pill)

**Active state:**
- Instead of `--primary-tint` background, use `filter: brightness(1.15)` or `box-shadow: inset 3px 0 0 #fff` (white left bar) to indicate selection while keeping the list color visible.

**Hover state:**
- Use `filter: brightness(0.9)` or `brightness(1.1)` to darken/lighten slightly on hover, keeping the color visible.

**Border between rows:**
- The current `border-bottom: 1px solid var(--border-subtle)` may look off against colored backgrounds. Change to `border-bottom: 1px solid rgba(255,255,255,0.15)` on colored rows for a clean separator.

**Mobile rounded corners (iOS grouped table):**
- On mobile, the `.lists` container has `border-radius: 12px` and individual rows have border-radius on first/last child. The colored backgrounds must respect these border-radius values so colors don't bleed outside the rounded container. This should already work since `background` respects `border-radius`, but verify.

#### Acceptance Criteria

- [ ] Each list row has its full list color as the background (no opacity/alpha)
- [ ] All text on colored rows is white and fully readable
- [ ] Item count text is slightly dimmed white (rgba) for hierarchy
- [ ] Active list row is visually distinguishable (brightness shift or left bar indicator) while keeping its color
- [ ] Hover state provides visual feedback without losing the color
- [ ] Row separators are visible against colored backgrounds (white semi-transparent border)
- [ ] Mobile rounded corners are preserved — no color bleeding
- [ ] Shared badge is readable on colored backgrounds
- [ ] The three-dot menu button is white and visible on all row colors (including yellow #f9a825 and lighter colors)
- [ ] Works in both light and dark mode
- [ ] Lint passes

---

## Credential & Service Access Plan

No external credentials required for this PRD. All changes use the existing Supabase project connection.

---

## Definition of Done

Implementation is complete when:

1. **Database:** A migration exists and has been applied. The `lists` table has a `color text NOT NULL DEFAULT '#1565c0'` column. Existing lists have the default blue color.
2. **Data flow:** `color` flows through `createList` → `subscribeLists` → context state → UI, and through `updateList` for edits.
3. **Create form:** Shows 10 color swatches with blue pre-selected. Selected color is saved to the database on list creation.
4. **Edit form:** Shows 10 color swatches with the list's current color pre-selected. Changing color and saving persists to the database.
5. **Row color:** Every list row in ListSelector has its full assigned color as background with white text. No opacity/alpha wash — the background matches the swatch color exactly.
6. **Active/hover states:** Active row is visually distinguishable (brightness or border indicator) while keeping its color. Hover provides feedback without losing color.
7. **Menu label:** "Name & Icon" is updated to "Name, Icon & Color" in both desktop dropdown and mobile action sheet.
8. **Dark mode:** Color swatches and colored row backgrounds look correct in dark mode.
9. **Lint passes** with no new warnings.
10. **Build succeeds** (`npm run build` exits 0).
