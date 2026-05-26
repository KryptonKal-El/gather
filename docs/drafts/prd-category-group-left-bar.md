# PRD: Category Group Left Bar Visual Treatment

**Status:** draft  
**Slug:** category-group-left-bar  
**Created:** 2026-05-26  
**Project:** Gather  

---

## Summary

The nested category headers inside store groups currently use a small color circle (dot) to indicate category color. This dot blends visually with the top-level store group header, making it hard to distinguish hierarchy at a glance. This PRD replaces the dot with a left vertical color bar that spans the full height of the category block (header + all items), and indents items 12px from the bar. The top-level store card treatment is unchanged.

---

## Background

- **Top-level groups** (stores): card with border, rounded corners, collapsible header. These are visually distinct and are not changed.
- **Nested groups** (categories, depth 1+): flat `<h4>` row with an 8px color dot. Items have no left indent. The dot is small and easy to miss — the category header blends with the store header.
- **Goal**: make category grouping scannable and clearly subordinate to the store group, without adding heavy card chrome.

---

## Locked Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | Should the bar span full height of the category block or header only? | Full height — bar runs from category label through all items in that category. |
| 2 | Apply bar treatment to top-level store groups too? | No — stores keep existing card/border treatment. Categories only. |
| 3 | Left indent for items from the bar on mobile? | 12px. |

---

## User Stories

---

### S-1 — Replace category color dot with full-height left bar

**Priority:** high

**Description:**  
As a shopper, when I view a shopping list with category groupings inside a store, I want each category to show a colored left vertical bar instead of a small dot, so I can quickly scan which items belong to which category.

**Acceptance Criteria:**

1. The `.nestedGroupDot` span is removed from the `GroupRenderer` depth 1+ render path in `ShoppingList.jsx`.
2. A left vertical color bar is rendered on the category block. The bar color matches `group.color ?? '#9e9e9e'`.
3. The bar spans the full height of the category block — from the category label row through all item rows beneath it.
4. The bar is 3px wide.
5. The category label text is no longer preceded by a color dot.
6. The `.nestedGroupDot` CSS class is removed or emptied in `ShoppingList.module.css`.
7. The top-level store group header (depth 0) is visually unchanged — its `.topLevelDot` and card treatment are untouched.
8. When a category has zero items, the bar height is at least the height of the `.nestedGroupTitle` row (no zero-height bar).
9. The `.nestedGroupTitle` left padding is removed or set to 0 — horizontal spacing from bar to label is controlled entirely by `.nestedGroup`'s `padding-left`.
10. `npm run lint` passes with no new errors.
11. `npm run build` succeeds.

**Flow Chart:**

```
1. ShoppingList.jsx — GroupRenderer (depth 1+) (src/components/ShoppingList.jsx)
   ├─ Remove <span className={styles.nestedGroupDot}> from the depth 1+ return block
   ├─ Wrap the depth 1+ return block in a container div that carries the left bar
   │    └─ Container uses a CSS class (e.g. .nestedGroup) with position: relative
   ├─ Add a bar element inside the container (e.g. <span className={styles.categoryBar}>)
   │    └─ Bar receives inline style={{ backgroundColor: group.color ?? '#9e9e9e' }}
   └─ Ensure bar element is positioned absolutely on the left, full height of container

2. ShoppingList.module.css (src/components/ShoppingList.module.css)
   ├─ Add .categoryBar: position absolute, left 0, top 0, bottom 0, width 3px
   ├─ Update .nestedGroup: add position: relative only — padding-left is handled in S-2
   ├─ Update .nestedGroupTitle: remove or zero out left padding
   └─ Remove or empty .nestedGroupDot

3. VERIFY QUALITY
   ├─ Run lint: npm run lint
   └─ Run build: npm run build
```

---

### S-2 — Indent items 12px from the left bar within a category block

**Priority:** high

**Description:**  
As a shopper, when I view items listed under a category, I want them visually indented from the left bar so it is clear they belong to that category group.

**Acceptance Criteria:**

1. All item rows rendered inside a category block (depth 1+ `GroupRenderer`) are indented 12px from the left edge of the category bar.
2. The indent is applied via CSS padding-left on the items container, not via inline styles.
3. The indent does not apply to top-level store group items (depth 0 ungrouped items or items in a store with no sub-categories).
4. On viewports ≤ 480px the indent remains 12px (no reduction).
5. Item content (checkbox, label, price) is not clipped or overflowed due to the indent.
6. `npm run lint` passes with no new errors.
7. `npm run build` succeeds.

**Flow Chart:**

```
1. ShoppingList.module.css (src/components/ShoppingList.module.css)
   ├─ Update .nestedGroup or add a child selector targeting the items container
   │    └─ Apply padding-left: calc(3px + 12px) = 15px (bar width + indent gap)
   └─ Verify no overflow on item rows at 320px viewport width

2. ShoppingList.jsx — GroupRenderer (src/components/ShoppingList.jsx)
   └─ Confirm items container inside depth 1+ block uses the CSS class that receives the indent
        └─ No inline padding-left overrides

3. VERIFY QUALITY
   ├─ Run lint: npm run lint
   └─ Run build: npm run build
```

---

### S-3 — Visual QA: category bar renders correctly across list configurations

**Priority:** medium

**Description:**  
As a developer, I want to verify the left bar treatment renders correctly across the range of list configurations the app supports, so no edge cases produce broken layouts.

**Acceptance Criteria:**

1. A store group with a single category: bar renders, items indented.
2. A store group with multiple categories: each category has its own bar in its own color; bars do not bleed into adjacent categories.
3. A store group with no sub-categories (items directly under store, no category): no bar is rendered, no unexpected indent.
4. The "Unassigned" ungrouped items block (top-level, no category): no bar, no indent change.
5. Dark mode: bar color is visible against the dark background (color is data-driven from `group.color`, no override needed — verify visually).
6. iOS (Capacitor shell): bar and indent render correctly at 390px viewport width (iPhone 14 Pro).

---

## Out of Scope

- Changing the top-level store group card, chevron, dot, or collapse behavior.
- Adding collapse/expand to category sub-headers.
- Changing item row layout, checkbox, or price display.
- Any changes to `CategoryEditor.jsx` or category data model.
