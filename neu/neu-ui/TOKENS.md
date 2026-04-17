# neu-ui Tokens

## Source Blend

- structural reference: `C:\Users\Administrator\Downloads\neu-code\vercel`
- accent reference: `C:\Users\Administrator\Downloads\neu-code\voice-three-control\src\css\main.css`

## Design Direction

The system should feel:

- restrained
- dark
- crisp
- slightly cinematic
- mobile-aware
- usable for dashboards, tools, scenes, editors, and control panels

Use Vercel-like discipline for spacing, edge definition, and typography. Use
the current project's gradients for emphasis, not as wallpaper.

## Core Color Tokens

### Neutrals

- `--ui-bg`: app background
- `--ui-bg-elevated`: raised dark background
- `--ui-surface-1`: matte panel
- `--ui-surface-2`: translucent panel
- `--ui-surface-3`: denser overlay
- `--ui-text`: primary text
- `--ui-text-muted`: secondary text
- `--ui-text-faint`: tertiary text
- `--ui-line`: standard outline
- `--ui-line-strong`: emphasized outline

### Accent Solids

- `--ui-teal`
- `--ui-mint`
- `--ui-coral`
- `--ui-gold`
- `--ui-cyan`
- `--ui-violet`

### Accent Gradients

- `--ui-gradient-primary`: teal to coral
- `--ui-gradient-signal`: mint to gold
- `--ui-gradient-glow`: cyan to violet to coral

## Depth

Keep depth subtle and layered.

- use shadow-as-border first
- blur only on overlays or floating controls
- keep radius small, usually `8px`

## Component Size Tokens

- `--ui-logo-button-size`: square size for reusable logo buttons
- `--ui-logo-button-padding`: inner padding for logo buttons
- `--ui-rank-scale-height`: default height for vertical rank scales
- `--ui-rank-track-width`: track thickness for vertical rank scales

## Component Size Tokens

- `--ui-logo-button-size`: square size for reusable logo buttons
- `--ui-logo-button-padding`: inner padding for logo buttons

## Typography

- preferred stack: `Geist, Inter, "Segoe UI", Arial, sans-serif`
- headings are tight and slightly compressed
- body copy is normal spacing
- labels are medium weight

## Reusable Pieces

- app shell
- floating control panel
- panel dock
- icon button
- toolbar chip
- primary button
- ghost button
- info card
- meters and signal bars
- toggle row
- badge pill

## Library Entry Points

- CSS: `index.css`
- JS: `index.js`

## Authoring Rule

When a new component is intended for reuse, add it to `neu-ui` first.

- do not create parallel shared component implementations inside project folders
- export reusable UI from `neu-ui`
- keep project-level UI files focused on local composition and small overrides

## Mobile UI

Shared mobile behavior belongs in `neu-ui`.

- stacked mobile layouts
- touch-friendly controls
- mobile-only visibility helpers
- safe bottom spacing helpers
- compact floating panels

## Do

- keep black backgrounds clean
- let gradients live on actions, meters, glow edges, and focused states
- use one primary gradient per screen
- keep layout edges neat and calm

## Avoid

- full-screen gradient washes
- oversized radius
- stacked glass cards inside glass cards
- using all accent colors equally at once
