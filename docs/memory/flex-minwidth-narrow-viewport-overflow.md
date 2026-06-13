# Flex overflow bugs: min-width and narrow-viewport verification

## Lesson

When a flex row's trailing buttons bleed outside their card (e.g. inline edit forms in settings rows), check **every level** of nested flex containers, not just the input. Flex items default to `min-width: auto`, so a `flex: 1` container will not shrink below its content's intrinsic width even if its children have `min-width: 0`. The fix is `min-width: 0` on the container itself (see `.editForm` in `UserStoreDefaultsManager.module.css`).

## Verification gotcha

The bug was invisible at desktop width — the modal had enough room. Always re-measure layout fixes at narrow viewports (375px and ~500px) with `preview_resize` before declaring them fixed; the settings modal is mobile-styled and users run it narrow.

## Related conventions

- Stores and Categories sections in Settings → List Type Defaults intentionally mirror each other (header row with count + "+ New" toggle, subtext, search bar, drag-handle + ⋯ menu rows, Delete All). When changing one, match the other.
