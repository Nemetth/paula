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

Still deferred:
- Conversational AI assistant for redistributing the plan from natural-language input — reorganization is handled by the structured "Algo cambió" sheet.
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
