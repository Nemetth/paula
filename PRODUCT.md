# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Paula, a community manager and publicista, is the sole user. She works solo, managing a portfolio ("cartera") of clients across social media content and Meta Ads campaigns. The app is strictly internal to her own work — her clients never log in or see any part of it. Primary usage is from her phone, with desktop as a synced secondary surface.

## Product Purpose

An internal work-management tool for Paula whose deeper goal is to work less and better by eliminating the time she currently loses deciding how to organize herself. The app does that thinking for her and tells her concretely what to do each day. It:
- Plans and paces her work across all clients so nothing is produced under last-minute pressure
- Tracks her cobros (payments owed/collected) per client
- Distributes tasks day-by-day so work never piles up at the end of a cycle

Success means every client delivery is reached with real anticipation instead of a rush, and Paula has a clear view of what she's owed/collected.

## Positioning

The core, most important mechanism: the app calculates backward from each client's delivery date and meters out an exact daily quota of work per client, so pieces are produced in the days before a deadline rather than all at once on it, and no client is ever left for last.

The second most important mechanism, and the one Paula values most: when she falls behind or something changes (missed a day, a recording moved, didn't finish something), the app reconstructs and redistributes the remaining plan across the following days on its own — she never rebuilds the plan by hand.

Neither mechanism is a generic task list or invoicing tool; both exist specifically to prevent the end-of-month/end-of-cycle crunch that is Paula's named, explicit pain point.

## Operating Context

- Each client has a monthly (or, for some, weekly) volume of pieces — historias, posteos/carruseles, reels — and its own flow: idea calendar → client approval → recording (if applicable) → production of pieces → presentation → client correction → adjustments → scheduling. Individual clients vary this flow (e.g., no calendar step, no recording step, correction-heavy clients, bilingual content, ads-only accounts with no content).
- Days Paula records leave no time for editing (only minimum daily blocks get done); each month's content takes 2–3 days of editing that must start well before the delivery date.
- Paula has a fixed weekly structure (one task type per day) plus blocks done every day, under a ~40 hour/week cap.
- The real client portfolio is larger than any example set and must support an unbounded number of clients, each with materially different volumes and flow particularities (e.g., recording done off-site requiring travel time factored into scheduling, content organized by fixed-percentage pillars, ads-only accounts with no content deliverables).
- A representative but partial sample of the client portfolio and their flow particularities is recorded in the original brief document; do not fabricate additional client data — use only what Paula provides.

## Capabilities and Constraints

First version (MVP) scope, confirmed:
- **Clientes:** full client record (name, rubro, service type — contenido/Ads/both, monthly volume per piece type, flow particularities, WhatsApp contact, approximate cobro window); an onboarding form that generates the client's work cycle automatically on save; a simulator to test whether a prospective client's workload fits before accepting them.
- **Ciclo mensual automático:** the app generates every stage of each client's flow as dated tasks, calculated backward from the delivery date, modeling each stage individually (not simplified) — this is the core of the product and without it the day-by-day distribution has no real basis. Anticipation rule: next month's calendar starts ~2.5 weeks before currently-published content runs out. Work is distributed in batches over the days before a delivery (2–3 days), never all on the delivery day, and respects recording days as non-editing days. Supports differing cycles per client (monthly, weekly, daily, ads-only, custom e.g. "X days after recording").
- **Plan del día:** a "Hoy" (today) view showing what's due today with real estimated hours per task, already paced to reach each delivery with anticipation. Reorganization when Paula falls behind or something changes is manual in this first version (she marks what happened; the app recalculates), not yet via a conversational AI assistant.
- **Plata (básico):** cobros per client with status (pending/paid) and alerts when the cobro window is missed.

Scope update (2026-10-07, after Paula's revised brief): the unit of work is now the **piece** (idea → aprobada → grabada → editada → entregada → programada), not the client stage, and recordings are their own entity (7-day delivery, travel days block the calendar). One global planner (`src/lib/domain/planner.ts`) spreads all pieces across Paula's free hours; nothing stores "the plan". This pulled the following in from the deferred list, all built: calendar (week/month), Ads module (daily check, deep-review rotation, monthly reports), idea bank, month-close summary, real hours per piece feeding the time estimates, content-runout alerts, pre-filled WhatsApp messages surfaced in Hoy, loose tasks ("+") and an alerts bell. Navigation is Hoy · Calendario · Clientes · Ads · Plata, with Ajustes on the gear.

Scope update (2026-10-22, Paula's second round): Hoy is one simple list — everything for today (pieces, the daily Ads check, fijos) with a "3 de 8 hechas" progress bar over it, then what is late or pending, with "si me sobra tiempo" folded at the end. Alerts are one folded line (and the bell); WhatsApp messages live in the bell and the client sheet, not in Hoy. Clientes became the place that shows what is done for each client (service, volume, records or not) and where delivery, recording and payment dates are edited, recalculating the plan. The daily cap is per weekday (`topesPorDia`). Ticks are logged per day (`tareas_hechas`) so Hoy can show and count them, and ticking only uses up that day's room instead of pulling new work in. Swipe right = done, left = to tomorrow (`pospuestas`); "Cerrar el día" moves what is left to tomorrow; when late work cannot fit, Hoy suggests a WhatsApp message to move the delivery. Visual system changed to cool greys + pastel pink + Outfit (see DESIGN.md). Migration `0008_hechas_y_pospuestas.sql`.

Scope update (2026-10-22, Paula's third round): each client has a delivery cycle — weekly or monthly, a delivery day, días de anticipación (default 15 monthly / 7 weekly), margin, graba or not, and a volume per cycle. The delivery date comes from that, never from a recording. Each delivery is a cycle (`ciclos` table) and its pieces are generated automatically (Historia 1…N) when the client is created, when the previous cycle is fully done, or when the next window opens; there is no manual piece loading. A piece is just done or not (`hecha`), ticked from a checklist with multi-select. The planner only places a piece inside its window [delivery − anticipación, delivery − margin], spreads each piece type evenly over the window's working days, and never places anything after its delivery: what doesn't fit is loaded over the day's cap and raises an overload alert (late work whose date already passed goes as soon as it fits). Pieces of a client that records enter the plan the day after the cycle's recording is marked done. Clientes cards show per-type progress, delivery, start and days left. The client file is four swipeable panels (Contenido · Ads · Plata · Notas). Ads adds a note per daily check (with history), the Ads Manager link, the account state and the last creative refresh (alert after 28 days). The plan and every counter (bell, Hoy, Plata badge) are computed once, only after all data has loaded, and opening Plata no longer writes cobros. Migration `0009_ciclos_y_piezas_hechas.sql`.

Scope update (2026-10-22, extras on top of the cycle model): Hoy opens with the day in one sentence ("Hoy: 4 historias de Bessone, 2 reels de Deluxe y el chequeo de Ads. Deluxe viene justa."), shows a streak of working days finished (`dias_cumplidos`), and can tick several rows at once. The overload message to move a delivery comes with a one-tap "Mover al …" (with undo). Finishing a cycle shows "Terminaste una entrega" with a WhatsApp to tell the client. The simulator runs the real plan with the prospect's next two deliveries and lists which current deliveries get worse and which days go over the cap. A delivery can get an extra piece without changing the client's volume. Graba clients get a reminder 5 days before production starts with no recording loaded. Ads shows one light per account. Plata shows the month on two bars. The client file's Plata panel has the client history (months together, deliveries on time, pieces and money this year, late payments); on-time is read from `piezas.hecha_en`. The morning notification is a web push sent at 08:00 Argentina by Vercel Cron (`/api/aviso-manana`, same sentence as Hoy), turned on per device from Ajustes. "Algo cambió" has "Contalo con tus palabras": Claude (`/api/asistente`) turns one sentence into proposed changes, which Paula reviews and confirms; nothing is applied server-side. Migrations `0010_racha_historial_avisos.sql` (schema) and `0011_datos_de_prueba.sql` (test data, "[Demo]" clients only). Env vars in `.env.example`.

Scope update (2026-10-29, Paula's fourth round): only reels wait for a recording; historias and posteos of a client that records are spread from the first day of the window. A delivery's light goes red when what is left (by weight) doesn't fit in the room left before it, counting pieces still waiting on a recording or an approval, and amber past half of it. Deliveries can also be twice a month ("Cada 15 días", two days of the month: `flujo.cicloTipo = "quincenal"`, `diaEntrega` + `diaEntrega2`). "Mensual" as a client type reads "Con calendario". Ads is organised as routines per account, each a planner unit that shows up in Hoy and the calendar: the daily check (as before), a weekly ads review on the account's own weekday (spread over the working days), the ads swap every 15 days from the last one (with a bell alert naming the account), and the monthly report spread over days 1–5 with room for the month's analysis and the new strategy; reviews and swaps are logged per account (`ads_historial`) and the client's Ads panel shows the whole history. Each delivery has a step (calendario armado → enviado → aprobado → producción → entregado → corrección → ajustes → programado, table `entregas_estado`, no row = production as usual): while the calendar is armado or enviado its pieces wait, and marking it aprobado lets them all in; marking entregado starts the client's correction days (`flujo.diasCorreccion`) and alerts when they pass; clients who send the material get a date it must arrive and an alert if it didn't; every delivery has a Canva/presentation link. Hoy says "Hoy te tocan N piezas" and a short note on overloaded days instead of the cap; the calendar counts pieces instead of "carga de capacidad". Migration `0012_pasos_y_rutinas_ads.sql`.

Still deferred:
- Choosing the hour of the morning notification (fixed at 08:00 by the cron schedule in `vercel.json`).
- Integrations: Google Calendar, Instagram (published content, to avoid repeating ideas), Canva/presentation links, backup.
- Special dates per rubro in the calendar (needs a source Paula provides).

Technical constraints:
- Must work on mobile and desktop, synced (an edit on one appears on the other); mobile is the primary surface.
- Installable PWA (Next.js). Backend: Supabase (Postgres + Auth + Realtime), one project dedicated to this app. Confirmed 2026-09-17.
- The app requires an internet connection to read or write data — there is no offline-local cache. Chosen deliberately over local-first sync to ship faster; revisit if Paula hits this as a real problem (e.g. spotty connection while filming on location).
- Single-user auth (email/password via Supabase Auth); Paula's account is created manually in the Supabase Dashboard, not through an in-app signup flow.
- WhatsApp integration, if/when built, only needs to open a pre-filled wa.me link — no official WhatsApp Business API required.
- Any AI-driven reorganization, when built later, can be implemented via a third-party language model API.

## Brand Commitments

Paula chose the standing/conventional design path over a distinctive visual world: a familiar, standard app aesthetic rather than a bespoke visual system. The craft bar for this standard execution is set by **Todoist/Things** — warm, mobile-first, task-focused, high-polish minimalism — executed at full fidelity rather than a generic, unpolished dashboard look.

## Evidence on Hand

A developer brief document (`brief-app-gestion.md.pdf`, provided by Paula) is the primary source of product truth and includes a partial sample table of real clients in her portfolio (service type, monthly volume by piece type, and flow particularities per client) — used to validate the scheduling logic, not to be treated as the full portfolio. No other content, data, testimonials, or assets exist yet; future work must not fabricate client names, sample data, pricing, or testimonials beyond what that brief provides.

## Product Principles

1. Anticipate, don't react — every delivery should be reached with real lead time; the app's job is to prevent last-minute pressure, not just record tasks.
2. Auto-reconstruction is the most valued behavior — when Paula's day changes, the app rebuilds the downstream plan itself; she should never have to manually re-plan.
3. Single-user, internal tool — every decision optimizes for Paula's own solo workflow, not multi-tenant or client-facing use.
4. Make money owed/collected legible at a glance, since cobros tracking is a named, explicit need.
5. Reduce Paula's daily cognitive load to "what do I do today" — the app should think about organization so she doesn't have to.

## Accessibility & Inclusion

No product-specific requirement established yet.
