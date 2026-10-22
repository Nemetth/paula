---
name: Paula
description: Internal work-planner for a solo community manager — today's paced task list, client cycles, and cobros.
colors:
  acento: "#F4B4C9"
  acento-texto: "#B23A64"
  oscuro: "#2A2E36"
  verde: "#2C6A50"
  ambar: "#8F6215"
  fondo: "#ECEFF3"
  tarjeta: "#FFFFFF"
  hundido: "#F1F3F6"
  texto: "#20242B"
  texto-secundario: "#5B6577"
  borde: "#E1E5EB"
  fondo-dark: "#121418"
  tarjeta-dark: "#1C1F26"
  oscuro-dark: "#333947"
  acento-dark: "#F2A9C1"
typography:
  display:
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.125rem"
    fontWeight: 600
  page-title:
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
  body:
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
rounded:
  sm: "8px"
  md: "12px"
  card: "20px"
  destacado: "24px"
---

# Design System: Paula

## Overview

**Creative North Star: "Gris claro, rosa de acento"** (2026-10-22, supersedes "Papel y sol de tarde")

Paula asked for the app to feel more dynamic and simpler: cool greys, white cards, dark grey for what matters, pastel pink touches; one typeface (Outfit) everywhere, centered titles, and motion that rewards doing things. Hoy is the product: one list of what to do today with a progress bar over it.

Light and dark are both first-class and follow the system theme.

## Personality (2026-10-22)

The app is Paula's, and it says so: it greets her by name (`NOMBRE` in `src/lib/domain/voz.ts`), reads the state of her day in one line under the greeting, and says how it is going under the progress bar. Voice is rioplatense, short, and always derived from real state (`voz.ts`), never random.

- **Inki is an easter egg** (the floating dog on Hoy and his stamp), plus the two places Paula asked for him: the 404 (`not-found.tsx`) and the crashed-page screen (`error.tsx`), both through `InkiAviso`. Do not surface him anywhere else or mention him in other copy. Note this Next version passes `retry` (not `reset`) to `error.tsx`.
- **The wallpaper** (`.trama`, `public/trama.svg`): a tile of community-manager marks (likes, comments, hashtags, reels, send, save, calendar, metrics) used as a mask over the text colour at 6–7% opacity, fading toward the bottom. It lives behind the cards, so it only shows in margins and gaps. Tune `--trama-opacidad`.
- **The seal** (`Sello`, `src/components/sello.tsx`): a round postmark with the text on the rim. It lands (`.sello-cae`) when the day is complete and when the day is closed. Finishing the day is stamping it.
- **The light** (`Luz`) is tinted by the hour: a little peach in the morning, plain pink in the day, a little lilac at night. Applied once, not animated.
- Name in the greeting is set in `acento-texto`; that is the only coloured word in any title.

## Colors

- **Fondo** (`#ECEFF3`, dark `#121418`): the cool grey ground. One soft pink pool of light (`.luz`) sits at the top, static (tinted by the hour, see Personality).
- **Tarjeta** (`#FFFFFF`, dark `#1C1F26`): `.papel`, the one container. 20px radius, cool soft shadow, hairline border. Inside a card use a sunken well (`bg-hundida`), never a nested card.
- **Oscuro** (`#2A2E36`): `.destacado` — the one dark card per screen (Hoy's progress), and the primary button. This is what "stands out".
- **Acento** (`#F4B4C9` pastel pink; text variant `acento-texto` `#B23A64` for anything that must be read): the tick, the progress fill, the active nav puck, "atrasada" chips, count badges. Pastel pink as a fill, never as small text on white.
- **Verde / Ámbar**: status only (paid, on track; approaching, uses margin).
- Token names in code: `acento`, `acento-texto`, `sobre-acento`, `oscuro`, `sobre-oscuro`, `verde`, `ambar`, `bg`, `bg-elevada`, `bg-hundida`, `texto`, `texto-secundario`, `borde`.

### Client palette
Each client keeps a fixed hue (`PALETA_CLIENTES` in `src/lib/domain/calendario.ts`), shown as a dot in rows and as the monogram in the roster. Identification colors, not status colors.

## Typography

Outfit for everything (`.titulo` = 600, -0.015em). No serif. Page titles are **centered** via `Encabezado` (`src/components/encabezado.tsx`): back arrow or action in the side slots, title in the middle, small context line above.

## Layout

Mobile-first single column, ~640px (760px on Hoy desktop). Desktop gets a 240px sidebar. Clientes is a grid of expandable cards on desktop.

## Motion

Everything collapses under `prefers-reduced-motion`.

- **The tick** (`tilde.tsx`): circle fills pink, check draws, sparks fly, buzz on phones. Tapping a filled tick undoes it.
- **Progress bar** (`.barra`): grows from 0 on arrival, eases to the new value on every tick, a shine passes along it.
- **Slide-in** (`.desliza`): list rows enter from the right, staggered; `.entra` rises from a blur for blocks.
- **Swipe** (`fila-deslizable.tsx`): right = done, left = to tomorrow; the action shows behind the row, release past 84px commits, otherwise it springs back.
- **Undo toast** (`aviso-deshacer.tsx`): slides up after a tick or a "mañana", 6 seconds.
- **Sheets, nav puck, route cross-dissolve, bell wiggle, rolling money totals**: unchanged.

## Components

- **Hoy list row** (`FilaHoy`): tick at left, client dot + name in small text, what it is in medium weight, date/chips below. Done rows stay in the list, muted and struck through, at the bottom.
- **Buttons**: primary = dark grey fill, white text (one per screen); secondary = bordered; icon buttons round.
- **Date fields** in Clientes save when the date is chosen from the calendar, or when the field loses focus if typed.

## Do's and Don'ts

- **Do** keep Hoy first and simple: today on top with progress, what's late below, "si me sobra tiempo" folded at the end.
- **Do** use pink as a fill/accent and `acento-texto` when it is text.
- **Don't** put two dark cards on one screen, nest a card in a card, or add a second looping animation.
- **Don't** use a colored side border to signal state; use a tint or a chip.
