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
  borde-dark: "#362E24"
  hueso-hundido: "#F3EEE5"
  hueso-hundido-dark: "#16120E"
typography:
  display:
    fontFamily: "Fraunces, ui-serif, Georgia, serif"
    fontSize: "2.125rem"
    fontWeight: 500
    lineHeight: 1.1
  display-lg:
    fontFamily: "Fraunces, ui-serif, Georgia, serif"
    fontSize: "2.5rem"
    fontWeight: 500
    lineHeight: 1.1
  page-title-lg:
    fontFamily: "Fraunces, ui-serif, Georgia, serif"
    fontSize: "2.25rem"
    fontWeight: 500
    lineHeight: 1.15
  page-title:
    fontFamily: "Fraunces, ui-serif, Georgia, serif"
    fontSize: "1.875rem"
    fontWeight: 500
    lineHeight: 1.15
  readout:
    fontFamily: "Fraunces, ui-serif, Georgia, serif"
    fontSize: "1.75rem"
    fontWeight: 500
    lineHeight: 1.2
  section-title:
    fontFamily: "Fraunces, ui-serif, Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 500
    lineHeight: 1.3
  small-serif:
    fontFamily: "Fraunces, ui-serif, Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.3
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
  chip:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.3
  badge:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1
  error-box:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  xs: "2px"
  sm: "8px"
  md: "12px"
  paper: "16px"
  lg: "20px"
  nav: "22px"
  sheet: "24px"
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

**Creative North Star: "Papel y sol de tarde"** (2026-10-08, supersedes "The Standing Order")

Paula asked for the app to feel prettier and more alive — better textures, things that move a little, more personality — and chose the **warm editorial** direction over both "same look, livelier" and "bolder". The product is still an Operate tool checked in short bursts, so the structure (Hoy-first, list rows, one accent, restrained status colors) is unchanged; what changed is the material. The app now reads like a good paper planner on a desk in afternoon light: a grain you can almost feel, warm light pooling at the top of the screen, cards that sit on the page like sheets of paper, a serif voice for titles and money, and one authored moment — ticking a task off.

Light and dark are both first-class and follow the system theme.

**Key Characteristics:**
- Warm neutral ground with static paper grain; two slow-drifting pools of warm light behind the content
- "Papel" surfaces: elevated, softly shadowed, finely grained cards holding list rows (rows themselves are never individually elevated)
- Fraunces (soft, optical-sized serif) for titles, greetings and money/hour readouts; Inter for every row, label and control
- Motion with a job: arrival stagger, sheets with exit, sliding nav puck, the tick, rolling money totals, route cross-dissolve
- Urgency and status still read from row tint and small labels, never colored borders

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

### Client palette
Each client gets a fixed earthy hue (arcilla, salvia, lavanda gris, ocre, petróleo, ciruela, oliva, cuero, azul pizarra, durazno tostado — `PALETA_CLIENTES` in `src/lib/domain/calendario.ts`). The same hue appears as the client's dot in rows, its monogram in the roster, its segment in Hoy's day strip and its dot in the calendar, so a client is recognisable by color across screens. These are identification colors, not status colors.

### Sunken neutral
- **Hueso Hundido** (`#F3EEE5`, dark `#16120E`): wells *inside* a paper surface — hour chips, quoted WhatsApp text, estimate boxes, a sheet's suggestion list. Use a well instead of nesting a card inside a card.

### Named Rules
**The One Voice Rule.** Terracota appears on at most one primary action and one urgency marker per screen (the floating "+" is global chrome and does not count). It is never used decoratively, and never for more than ~10% of a screen's surface.

**The No-Border Rule.** Status and urgency are read from a row's background tint, a small label, or an icon — never from a colored left/right border on a row, card, or alert.

## Typography

**Display / title font:** Fraunces (variable, `SOFT` 100, optical sizing on), weight 500, tracking -0.02em — via the `.titulo-serif` class.
**UI font:** Inter (with `ui-sans-serif, system-ui, sans-serif` fallback) for everything else.

**Character:** Fraunces carries the voice — greetings, page titles, section titles in detail views and Plata, sheet titles, empty-state titles, and the numbers Paula actually reads (hours today, peso totals). Inter does the work — rows, labels, buttons, inputs. Never set a row's client name or any control in Fraunces. The sidebar/top-bar wordmark is Fraunces italic followed by a small terracota dot.

### Hierarchy
- **Display** (Fraunces 500, 2.125rem / lg 2.5rem): Hoy's time-of-day greeting only ("Buen día", "Buenas tardes").
- **Page title** (Fraunces 500, 1.875rem / lg 2.25rem): every other screen's h1.
- **Readout** (Fraunces 500, 1.75rem, tabular nums): hours today, "por cobrar", simulator total.
- **Section title** (Fraunces 500, 1.25rem): sheet titles, empty-state titles, Plata/ficha section headings, balance amounts.
- **Small serif** (Fraunces 500, 1.125rem): calendar period title, day-detail heading.
- **Body** (Inter 400, 1rem) · **Detail** (Inter 400, 0.9375rem) · **Label** (Inter 500, 0.8125rem) as before.
- **Chip** (Inter 500, 0.75rem): "atrasada" tag, nav labels. **Badge** (0.6875rem): integer count pills.

### Named Rules
**The Readable-Numbers Rule.** Hours and pesos may use the serif readout size, because legibility of money and today's load is a named product principle — but never larger than 1.75rem, never with a decorative accent, and always paired with a plain-language context line ("h de 8 h libres", "Nada vencido"). Piece counts inside rows stay body weight.

## Layout

Mobile-first single column, capped at a ~640px content measure and centered on wider viewports. Horizontal padding 16–20px; vertical rhythm between list items 12–16px; more space above a group/section header than below it (24px above, 8px below). Primary navigation is a floating bottom tab bar (Hoy · Calendario · Clientes · Ads · Plata) with safe-area inset padding — see Components → Navigation.

### Desktop (≥1024px)

Superseded 2026-09-17: desktop deliberately diverges from mobile now, reading as a standard SaaS work app rather than a reflowed phone screen — Paula wanted the desktop surface to look like ordinary software, not an oversized mobile view. Mobile IA and the mobile-specific rules above (bottom tab bar, borderless list rows, single column) are unchanged; everything in this section only takes effect at the `lg` breakpoint.

- **Sidebar, not a bottom bar.** A fixed 240px-wide left sidebar (`{colors.hueso-elevado}` background, `{colors.borde}` right edge) replaces the bottom tab bar: wordmark at top, the five sections as a vertical nav list, Ajustes pinned to the bottom. Active state and the Plata vencidos counter reuse the same terracota-tint + integer-pill treatment the bottom bar uses on mobile.
- **Wider content, still centered.** Each screen's content column widens (screen-dependent, ~720–960px) and content that was a bare bordered list on mobile gets wrapped in a bordered, `{colors.hueso-elevado}`-filled panel — the "card" read of a generic SaaS dashboard — while the rows inside keep the same Task Row/list-row anatomy, not a card-per-item grid.
- **Client roster is the one exception that becomes a real card grid** (2–3 columns depending on width) on desktop only — this is the one place PRODUCT.md's "not a card grid" rule is intentionally overridden above `lg`, because a roster reads naturally as a grid of contact cards in desktop software; the mobile roster stays a plain list.
- **Stat cards.** Where mobile stacks a single metric block (horas de hoy, por cobrar), desktop lays equivalent metrics out side-by-side as a row of stat cards — still following the Numerals-Are-Content Rule (body-weight numbers, no hero metrics).
- Forms (nuevo cliente, editar cliente, ajustes, simulador) get the same panel treatment: the form sits inside a bordered/elevated card instead of directly on the page background.

## Elevation & Depth

Surfaces are paper on a desk. The page ground carries a static SVG grain (`--grano`); paper surfaces carry a finer one (`--grano-fino`). Behind everything, `.luz` paints two blurred radial pools (ámbar top-right, terracota top-left) that drift over ~40s; frozen under reduced motion, dimmed in dark mode. No overlay blend layers — grain is a background layer only, so it costs nothing after first paint.

### Shadow Vocabulary
- **papel** (`--shadow-papel`): 1px inset top highlight + short contact shadow + soft offset blur, warm-tinted. Default for cards, the day readout, list containers, fijos chips.
- **papel-alto** (`--shadow-papel-alto`): the same, lifted — floating bottom nav, selected calendar day, dragged-over week column, desktop roster card hover.
- **boton** (`--shadow-boton`): primary buttons and the "+" — inner top light, inner bottom shade, small terracota-tinted drop.
- **sheet** (`--shadow-sheet`): upward shadow under bottom sheets.

### Named Rules
**The Paper Rule.** Lists live inside one paper surface with hairline dividers; individual rows are never elevated. Inside a paper surface, use a sunken well (`bg-hundida`), never a nested card.

## Shapes

8px chips and status pills · 12px buttons, inputs, rows · 16px paper surfaces · 20px desktop form panels · 22px floating bottom nav · 24px sheets. Full-round only for icon buttons, the fijos toggle chips, monograms and count badges. The "+" is an 18px-radius rounded square, not a circle.

## Motion

One authored moment, the rest is feedback and continuity. Ease-out `cubic-bezier(0.16, 1, 0.3, 1)` for arrivals; a slight overshoot (`--ease-resorte`) only for the small "yes" pops. Everything collapses to instant under `prefers-reduced-motion`.

- **The tick (focal):** tapping a task's circle fills it verde, draws the check, throws six tiny sparks, buzzes 12ms on phones, strikes the detail line, and only then (450ms) writes — the row exhales and the plan re-derives without it. Component: `src/components/tilde.tsx`; reused in "Me sobró tiempo".
- **Arrival:** `.entra` — rise 10px out of a 4px blur, staggered 45ms per item, capped at 10 slots. Content is visible if the animation never runs.
- **Route change:** the page column cross-dissolves via React `<ViewTransition default="pagina">`; nav chrome stays still.
- **Sheets:** backdrop dissolves, panel rises; closing animates out before unmount. Escape closes.
- **Nav:** the active "puck" slides between tabs (bottom bar and sidebar); the newly active icon pops.
- **Feedback:** `.tocable` press-scale on every tappable thing; fijos and Ads/Plata status toggles pop when they land on a state; peso totals roll from old to new value; the bell wiggles once when there are alerts; the "Algo cambió" confirmation turns its arrows once ("Plan reacomodado").
- **Ambient:** the light pools and the empty-state sun (rays turn over 40s, core breathes) are the only loops.

## Components

### Buttons
- **Primary** (`.boton-primario`): terracota fill, hueso text, `--shadow-boton`, 12–14px radius; hover lightens slightly. One per screen.
- **Secondary:** transparent or `bg-elevada/60`, 1px borde border, hover tints with `borde/40`. "Add" affordances that create structure (simulator link, "Agregar fijo") use a dashed border.
- **Icon buttons:** full-round, hover `borde/50`; destructive ones hover terracota/10.
- **Focus:** 2px terracota outline, 2px offset, everywhere (`:focus-visible`).

### Task Row (signature component)
- Animated tick circle at left (see Motion), client color dot + client name (600) on line one with an optional "atrasada" chip, stage/limit detail (0.9375rem, secondary) on line two, hours in a sunken chip at right.
- Urgent rows: ~6% terracota wash (never a border).
- Non-tickable units show a document icon instead of the circle.

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
- **Mobile:** a floating paper bar inset 12px from the edges (22px radius, papel-alto), five tabs (Hoy · Calendario · Clientes · Ads · Plata) with a sliding terracota/11 puck behind the active one. A sticky top bar carries the italic "Paula." wordmark and the alerts bell; the global "+" floats above the bar.
- **Desktop (≥1024px):** 240px grained sidebar, wordmark at top, same items with a sliding puck, Ajustes pinned at the bottom.

## Do's and Don'ts

### Do:
- **Do** keep Hoy as the app's landing screen — it is the first viewport's whole job (see PRODUCT.md Positioning).
- **Do** mark urgency with row-background tint and a text label, per the No-Border Rule.
- **Do** keep terracota to one primary action + urgency marking per screen, per the One Voice Rule.
- **Do** let a genuinely empty "Hoy" list read as a positive, explicit state ("Vas bien — nada urgente hoy"), never a blank page.

### Don't:
- **Don't** build the client roster or Hoy list as a card grid or kanban board **on mobile** — these are lists, per PRODUCT.md's Operate mode and the chosen standard-not-bespoke register. (Desktop's roster grid is the one deliberate exception — see Layout → Desktop.)
- **Don't** add gradients beyond the two ambient light pools, gradient text, decorative glass, progress rings or sparklines. (Hoy's client-colored day strip is a meter of real hours, not a decoration.)
- **Don't** add a second loop animation or a page-load choreography; motion beyond the list in Motion needs a job.
- **Don't** nest a card inside a paper surface — use a sunken well.
- **Don't** invent a second accent hue beyond terracota/verde-al-dia/ambar-aviso. Client identification colors come only from the client palette.
- **Don't** use a colored left-border on any row, card, or alert to signal state — it's an unresolved decision the No-Border Rule already settled.
