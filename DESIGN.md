---
name: Paula
description: Internal work-planner for a solo community manager — today's paced task list, client cycles, and cobros.
colors:
  terracota: "#D9502D"
  terracota-dark: "#E8693F"
  verde-al-dia: "#3F7A5C"
  verde-al-dia-dark: "#4F9573"
  ambar-aviso: "#C98A2E"
  ambar-aviso-dark: "#D9A24E"
  hueso: "#FAF7F2"
  hueso-elevado: "#FDFCFA"
  carbon: "#211D18"
  carbon-dark-bg: "#1B1712"
  carbon-dark-elevado: "#221D17"
  hueso-dark-text: "#F5F0E6"
  gris-musgo: "#6B6558"
  gris-musgo-dark: "#B5AC9A"
  borde: "#E8E2D6"
  borde-dark: "#332C22"
typography:
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  detail:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.3
rounded:
  sm: "8px"
  md: "12px"
  lg: "20px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.terracota}"
    textColor: "{colors.hueso}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.terracota-dark}"
    textColor: "{colors.hueso}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
---

# Design System: Paula

## Overview

**Creative North Star: "The Standing Order"**

Paula chose the standing/conventional path over a bespoke visual world (recorded in PRODUCT.md's Brand Commitments): a familiar, standard task-app register rather than an invented identity, executed at the craft level of **Todoist/Things** rather than a generic, unpolished dashboard. The system is deliberately quiet — one warm neutral ground, one confident accent spent only on action and urgency, and native mobile list rows instead of cards or kanban columns. Nothing here is trying to look distinctive; it is trying to disappear so the day's list is the only thing Paula has to read.

Density is high but calm: this is a tool checked in short bursts between production tasks, so every row must be scannable in a glance, not admired. Light and dark are both first-class — Paula works at all hours, on her phone, so the surface follows system theme rather than defaulting to one.

**Key Characteristics:**
- Warm neutral ground (bone, not stark white or cold gray), one accent color, restrained strategy
- Native mobile list rows with checkable affordances, not cards or kanban
- Urgency and status read from row-level tint and small labels, never from colored borders
- Inter throughout; no display/decorative face — this is an Operate surface, not a persuasion surface

## Colors

Restrained strategy: neutrals carry the surface, one accent (terracota) carries action and urgency, two supporting roles (verde-al-dia, ambar-aviso) carry status only.

### Primary
- **Terracota Encendida** (`#D9502D`, dark-mode `#E8693F`): primary actions (buttons, active nav tab), and the marker for genuinely urgent tasks (due today/tomorrow, or a client falling behind). Reserved — see the One Voice Rule.

### Secondary
- **Verde Al Día** (`#3F7A5C`, dark-mode `#4F9573`): on-track and paid states — a cobro marked `pagado`, a client with nothing due today read as good news, not silence.

### Tertiary
- **Ámbar de Aviso** (`#C98A2E`, dark-mode `#D9A24E`): approaching-deadline and cobro-window warnings that are not yet urgent or overdue — the middle state between verde and terracota.

### Neutral
- **Hueso Cálido** (`#FAF7F2`, dark-mode background `#1B1712`): page background.
- **Hueso Elevado** (`#FDFCFA`, dark-mode `#221D17`): elevated surfaces — the bottom nav bar, sheets, inputs.
- **Carbón Cálido** (`#211D18`, dark-mode text `#F5F0E6`): primary text.
- **Gris Musgo** (`#6B6558`, dark-mode `#B5AC9A`): secondary/meta text — always tinted warm from the neutral hue, never plain gray.
- **Borde** (`#E8E2D6`, dark-mode `#332C22`): hairline dividers between list rows and section edges.

### Named Rules
**The One Voice Rule.** Terracota appears on at most one primary action and one urgency marker per screen. It is never used decoratively, and never for more than ~10% of a screen's surface.

**The No-Border Rule.** Status and urgency are read from a row's background tint, a small label, or an icon — never from a colored left/right border on a row, card, or alert.

## Typography

**Body Font:** Inter (with `ui-sans-serif, system-ui, sans-serif` fallback)

**Character:** A workhorse UI face used exactly as intended — no display pairing, no italic accents. This is an Operate surface; typography's job is unambiguous scanning, not personality.

### Hierarchy
- **Title** (600, 1.25rem, 1.3 line-height): screen headers ("Hoy", "Clientes", "Plata") and client names in roster/detail views.
- **Body** (400, 1rem, 1.5 line-height): form fields and running prose (notes, empty-state copy, sheet explanations).
- **Detail** (400, 0.9375rem, 1.4 line-height): the second line of a list row — task descriptions under a client name, secondary roster/cobro lines. One deliberate step below Body for row-dense screens; not a substitute for Label.
- **Label** (500, 0.8125rem, 1.3 line-height): stage chips, meta lines (hours estimate, day count), nav bar labels.

### Named Rules
**The Numerals-Are-Content Rule.** Piece counts and hour estimates are body weight, never oversized "hero metric" numerals — they are one fact in a row, not the row's reason to exist.

## Layout

Mobile-first single column, capped at a ~640px content measure and centered on wider viewports. Horizontal padding 16–20px; vertical rhythm between list items 12–16px; more space above a group/section header than below it (24px above, 8px below). Primary navigation is a fixed bottom tab bar (Hoy / Clientes / Plata) with safe-area inset padding.

### Desktop (≥1024px)

Superseded 2026-09-17: desktop deliberately diverges from mobile now, reading as a standard SaaS work app rather than a reflowed phone screen — Paula wanted the desktop surface to look like ordinary software, not an oversized mobile view. Mobile IA and the mobile-specific rules above (bottom tab bar, borderless list rows, single column) are unchanged; everything in this section only takes effect at the `lg` breakpoint.

- **Sidebar, not a bottom bar.** A fixed 240px-wide left sidebar (`{colors.hueso-elevado}` background, `{colors.borde}` right edge) replaces the bottom tab bar: wordmark at top, Hoy / Clientes / Plata as a vertical nav list, Ajustes pinned to the bottom. Active state and the Plata vencidos counter reuse the same terracota-tint + integer-pill treatment the bottom bar uses on mobile.
- **Wider content, still centered.** Each screen's content column widens (screen-dependent, ~720–960px) and content that was a bare bordered list on mobile gets wrapped in a bordered, `{colors.hueso-elevado}`-filled panel — the "card" read of a generic SaaS dashboard — while the rows inside keep the same Task Row/list-row anatomy, not a card-per-item grid.
- **Client roster is the one exception that becomes a real card grid** (2–3 columns depending on width) on desktop only — this is the one place PRODUCT.md's "not a card grid" rule is intentionally overridden above `lg`, because a roster reads naturally as a grid of contact cards in desktop software; the mobile roster stays a plain list.
- **Stat cards.** Where mobile stacks a single metric block (horas de hoy, por cobrar), desktop lays equivalent metrics out side-by-side as a row of stat cards — still following the Numerals-Are-Content Rule (body-weight numbers, no hero metrics).
- Forms (nuevo cliente, editar cliente, ajustes, simulador) get the same panel treatment: the form sits inside a bordered/elevated card instead of directly on the page background.

## Elevation & Depth

Flat by default — list rows and page backgrounds carry no shadow, separated only by hairline dividers (`{colors.borde}`). Depth is reserved for surfaces that float above content: the bottom nav bar and any sheet/dialog get a soft upward shadow to lift them off the page.

### Shadow Vocabulary
- **nav-lift** (`box-shadow: 0 -2px 16px rgba(33, 29, 24, 0.08)`): under the bottom nav bar, light mode. Dark mode: `0 -2px 16px rgba(0, 0, 0, 0.35)`.
- **sheet-lift** (`box-shadow: 0 8px 32px rgba(33, 29, 24, 0.16)`): under any modal sheet (used sparingly — see Do's and Don'ts).

### Named Rules
**The Flat-By-Default Rule.** Shadows appear only on surfaces that genuinely float above the page (nav bar, sheets). A list row is never elevated.

## Shapes

Rounded but not soft-play: 12px radius on interactive containers (buttons, inputs, task rows when grouped in a block), 8px on small chips/tags (stage labels, status pills), 20px on the bottom nav bar's top corners (reads as a bottom sheet, not a browser chrome bar). No pill-shaped (full-round) buttons — this is a tool, not a marketing surface.

## Components

### Buttons
- **Shape:** 12px radius (`{rounded.md}`)
- **Primary:** terracota background, hueso text, 12px/20px padding — reserved for the single most important action on a screen (e.g. "Agregar cliente", "Guardar").
- **Hover / Focus:** background shifts to `terracota-dark`; focus adds a 2px terracota ring offset 2px from the element, never a color change alone.
- **Secondary / Ghost:** transparent background, carbón text, borde-colored 1px border; used for every non-primary action so the primary stays singular per screen.

### Task Row (signature component)
- A tappable leading circle (checkbox) at left; client name (title weight) + stage/quantity detail (body, secondary color) on two lines; hours estimate right-aligned in label weight.
- Urgent rows: the whole row background tints to a ~6% terracota wash (never a border), plus a small "hoy"/"mañana" label.
- Done rows: leading circle fills verde-al-dia, row text drops to secondary color with a strikethrough on the detail line only (not the client name).

### Stage Chip
- **Style:** background = borde color at 60% opacity, text = carbón/gris-musgo, 8px radius, label-weight text, no icon by default.
- **State:** a stage landing today swaps to a 10% terracota wash instead of neutral.

### Status Pill (cobros)
- **Style:** 8px radius, label weight. `pendiente` = ambar-aviso wash + text; `pagado` = verde-al-dia wash + text; `vencido` = terracota wash + text. Fill, never a border-only outline — this must be legible at a glance, not on close inspection.

### Inputs / Fields
- **Style:** hueso-elevado background, 1px borde border, 12px radius, 1rem body text.
- **Focus:** border shifts to terracota at full opacity, no glow/halo.
- **Error:** border shifts to terracota, helper text below in terracota, states the problem and the fix (never "invalid input").

### Navigation
- **Mobile:** fixed bottom tab bar, 3 items (Hoy / Clientes / Plata), icon + label weight text. Active tab: icon and label in terracota; inactive: gris-musgo. No badge dots — unread/urgent counts are integers in a small label-weight pill instead.
- **Desktop (≥1024px):** fixed 240px left sidebar with the same 3 items plus Ajustes, vertical instead of horizontal; same active/inactive coloring and integer-pill counter. See Layout → Desktop.

## Do's and Don'ts

### Do:
- **Do** keep Hoy as the app's landing screen — it is the first viewport's whole job (see PRODUCT.md Positioning).
- **Do** mark urgency with row-background tint and a text label, per the No-Border Rule.
- **Do** keep terracota to one primary action + urgency marking per screen, per the One Voice Rule.
- **Do** let a genuinely empty "Hoy" list read as a positive, explicit state ("Vas bien — nada urgente hoy"), never a blank page.

### Don't:
- **Don't** build the client roster or Hoy list as a card grid or kanban board **on mobile** — these are lists, per PRODUCT.md's Operate mode and the chosen standard-not-bespoke register. (Desktop's roster grid is the one deliberate exception — see Layout → Desktop.)
- **Don't** add gradients, glassmorphism, progress rings, or sparklines anywhere in this system.
- **Don't** invent a second accent hue beyond terracota/verde-al-dia/ambar-aviso.
- **Don't** use a colored left-border on any row, card, or alert to signal state — it's an unresolved decision the No-Border Rule already settled.
