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

### US-004: Display List Color as Row Background Tint

**As a** user  
**I want** to see my list's color as a subtle background wash on its row  
**So that** I can quickly identify lists visually  

#### Details

**List row rendering** (`ListSelector.jsx`, `renderListItem` function):
- Apply an inline style to the `.listItem` div using the list's `color` value
- Use the color at low opacity (~10-15%) as a background tint: `backgroundColor: list.color + '1A'` (hex with alpha) or use `rgba` conversion
- The tint should be visible but subtle — it should NOT overpower the text or the active/hover states
- Active state (`.active`) and hover state should blend with or override the tint naturally

**Considerations:**
- The background tint applies to ALL list rows (owned + shared)
- Light mode: the tint should be barely visible (10-12% opacity)
- Dark mode: the tint may need slightly higher opacity (12-18%) to be visible against the dark background — test and adjust
- The tint should NOT conflict with the `.active` highlight (primary-tint). When a list is active, the active style takes precedence.

#### Acceptance Criteria

- [ ] Each list row shows a subtle background tint matching its assigned color
- [ ] The tint is visible but does not reduce text readability
- [ ] Active list row still shows the primary-tint highlight (active state wins)
- [ ] Hover state still works naturally on desktop
- [ ] Tint renders correctly in both light and dark mode
- [ ] Lists with the default color (blue) show a blue-ish tint
- [ ] Shared lists also show their color tint
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
5. **Row tint:** Every list row in ListSelector displays a subtle background tint derived from its color. The tint does not break active/hover states or text readability.
6. **Menu label:** "Name & Icon" is updated to "Name, Icon & Color" in both desktop dropdown and mobile action sheet.
7. **Dark mode:** All color swatches and background tints are visually correct in dark mode.
8. **Lint passes** with no new warnings.
9. **Build succeeds** (`npm run build` exits 0).
