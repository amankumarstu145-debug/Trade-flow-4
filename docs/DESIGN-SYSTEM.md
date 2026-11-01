# TradeFlow design system

All tokens and shared components live in [`css/design-system.css`](../css/design-system.css), which loads after `styles.css`. Tailwind's settings in `index.html` point at the same scale, so utility classes follow it too.

## Colour: one meaning each

| Role | Token | Light | Use for |
|---|---|---|---|
| Brand / main action | `--tf-brand` | `#047857` | Main buttons, selected tab, chip or filter, links, focus rings |
| Warning | `--tf-warn-bg` / `--tf-warn-fg` | `#fffbeb` / `#92400e` | "Needs action", missing documents, count badges |
| Danger | `--tf-danger` | `#b91c1c` | Overdue amounts, deletes and errors only |
| In progress | `--tf-info-bg` / `--tf-info-fg` | `#eff6ff` / `#1e40af` | In production, in transit |
| AI | `--tf-ai` | `#6d28d9` | Smart Fill and other AI features only |
| Surfaces | `--tf-surface`, `--tf-warm`, `--tf-soft`, `--tf-line` | warm neutrals | Cards, off-white headers, tiles, borders |

Every colour has a dark-mode value under `html.dark`. Text must reach 4.5:1 contrast.

## Type

- One family: **Plus Jakarta Sans**. Numbers use even-width digits (`tabular-nums`), not a code font.
- Seven sizes: **12, 13, 14, 16, 19, 22, 28 px**. Nothing on screen is smaller than 12 px. Printed invoice sheets may use 10.5 px so an A4 page fits.
- Four weights: 400, 500, 600, 700.
- Labels in Sentence case. No UPPERCASE, no wide letter spacing.

## Shape, spacing, depth

- Corners: 8 px (inputs, chips, small buttons), 12 px (buttons, tiles, number tiles), 16 px (cards, boxes), full (pills).
- Spacing in 4 px steps (4, 8, 12, 16, 20, 24, 32).
- Shadows: `--tf-shadow-1` (resting card), `-2` (hover), `-3` (dialogs).

## Layers (z-index)

page < sticky bars (10) < menus (40) < side panels (60) < pop-ups (100–195) < partner windows (150) < demo-fill button (240) < **confirm dialog (250)** < messages (300). A confirmation is always on top.

## Icons

Lucide icons only, from the bundled set. No emoji in buttons, chips, labels or messages. WhatsApp message text sent to partners may keep emoji.

## Components

| Class | What it is |
|---|---|
| `tf-btn` (`--primary`, `--danger`, `--ghost`, `--ai`, `--sm`) | Buttons: 44 px tall (36 px small) |
| `tf-chip` (`.is-on`) | Filter chips |
| `tf-badge` (`--ok`, `--warn`, `--danger`, `--info`, `--ai`) | Status labels |
| `tf-card`, `tf-card__head` | Card with an off-white header |
| `tf-box`, `tf-box__head`, `tf-box__title`, `tf-box__body` | Section box with a header and an Edit button |
| `tf-tile`, `tf-label`, `tf-hint` | Detail tile (tap to copy) |
| `tf-kpi`, `tf-kpi__value` | Summary number tile |
| `tf-input` | Text field |
| `tf-table` | Data table |
| `tf-empty` | Empty state |
| `tf-dialog` | Pop-up window body |

The partner pages (`js/partner-ui.js`, `pu-*` classes) read the same tokens.
