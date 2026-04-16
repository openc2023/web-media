# neu-ui Reference

A reusable UI reference for projects in this workspace.

This set keeps the clean restraint of the local `vercel/` reference while
preserving the stronger accent gradients already working well in
`voice-three-control/`.

## Files

- `TOKENS.md`: design rules and token meanings
- `tokens.css`: reusable design tokens
- `components.css`: reusable component recipes
- `index.css`: one CSS entry point
- `panel.js`: collapsible panel behavior
- `switch.js`: checkbox/toggle behavior
- `index.js`: one JS entry point
- `preview.html`: static visual reference page

## Intent

- dark-first interface language
- mobile-aware component behavior
- Vercel-style structure and border/shadow discipline
- brighter gradients only where they help interaction or focus
- no landing-page fluff, mostly practical UI pieces

## Reuse

1. Load `index.css`
2. Import `index.js` if you need shared UI behavior
3. Use the classes and variables in your project

## Direct Use

```html
<link rel="stylesheet" href="/neu-ui/index.css" />
<script type="module">
  import { createCollapsiblePanel } from "/neu-ui/index.js";
</script>
```

## Extension Rule

All new shared UI components must be added inside `neu-ui`.

- add new reusable CSS in `neu-ui/components.css` or a new file exported by `neu-ui/index.css`
- add new reusable JS behavior in `neu-ui/` and export it from `neu-ui/index.js`
- do not create one-off shared UI components inside app folders when they are meant to be reused
- app folders may keep only thin local overrides for layout or feature-specific visuals

## Mobile Rule

`neu-ui` must own shared mobile UI behavior too.

- responsive layout rules belong in `neu-ui/components.css`
- reusable mobile helpers belong in `neu-ui`
- touch sizing, safe spacing, compact panels, and stacked mobile layouts should be defined here
- project folders should not create a separate mobile UI system when the pattern is reusable

## Good Defaults

- backgrounds stay near-black
- surfaces use soft translucency or deep matte panels
- borders are subtle, mostly shadow-as-border
- gradients are reserved for primary action, live data, and glow states
