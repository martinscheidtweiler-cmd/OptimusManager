# Optimus Manager — release gate (not deployed)

This branch is a **staging candidate**, not a confirmed production release. Do not merge, deploy or apply migrations to the shared live database before passing the checks below.

## What is built
- Premium mobile-first manager navigation and daily dashboard
- Dedicated `/login` and `/move` staff workflow (admin / planner / member)
- Atomic group movements and audit trail via `optimus_move_group`
- Server-side persisted, **unsent** HorseID review drafts for cross-site changes
- Care and breeding registrations, veterinary cases and follow-up dates
- Medication product inventory, audited receipts/use and low-stock notices
- Future-invoicing **read-only** endpoint

## Database — apply to a staging copy IN ORDER
1. `202611200001_stable_manager_modules.sql` — new care, cases, stock, HorseID tables (RLS fail-closed)
2. `202611200002_atomic_group_moves.sql` — private authorized movement function, public invoker wrapper, deduplication and durable HorseID drafts
3. `202611200003_manager_care_rls.sql` — admin-only clinical data access
4. `202611200004_harden_legacy_location_access.sql` — remove unsafe public writes and replace legacy move RPC
5. `202611200005_medication_stock_movements.sql` — transactional stock ledger and read-only history

The old live Supabase installation has permissive location RLS policies and an `anon`-executable `move_horse_v2` SECURITY DEFINER function. It MUST be remediated in a planned, tested migration. Never use this API unprotected in production.

## Required staging tests
- `anon`: legacy movement RPC, table updates, inserts, deletes and truncates must fail
- `authenticated` but no active Optimus account: movement RPC must fail
- Active `member` / `planner`: atomic moves work; direct table writes and medical records are denied
- Active `admin`: all manager screens and needed edit actions work
- Moving multiple horses is all-or-nothing. Blocked unit, missing horse, inactive horse or duplicate horse ID must not modify any records
- Repeating the same `p_request_id` returns the original count and does not generate duplicate assignments/outbox items
- Concurrent requests to move one horse are serialized; source/destination location remains consistent
- Cross-site movement creates one **unsent** outbox row per moved horse; same-site moves do not
- Site changes do NOT imply official HorseID-establishment changes; verify establishment IDs and chip numbers manually
- A failed stock adjustment rolls back both stock and history; negatives never leave a negative balance
- Run RLS/security advisors and inspect foreign keys, ownership and production dependencies before migration 0004
- Do not delete/rename existing horse data, polygons, photos or movement history

## Frontend CI
Use GitHub Actions: `npm ci`, `npx tsc --noEmit`, `npm run lint`, `npm run build`. Confirm a successful run; commit statuses alone may not include GitHub check runs. Manual mobile/browser tests: login, staff role redirect, bottom nav, source/destination selection, map drag/drop, existing horse profile, care case, stock and draft copying.

No GitHub Actions run was confirmed through available project tooling when this checklist was authored; do not describe the build as verified.

## HorseID emails
`optimus_horseid_outbox` only creates internal draft records. `HorseIdTab` displays the drafts and supports copying an email addressed to `veronique@dsf.be`. No automatic sending or HorseID mutation exists. Sending externally requires explicit user approval and verified official registration data.

## Future invoicing API
`GET /api/invoicing/horse?horse_id=<uuid>` reads a minimal horse record. It never creates or emails an invoice.
Set server-only environment variables `OPTIMUS_INVOICING_API_TOKEN` (32+ random characters), `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`. Never add these values to `NEXT_PUBLIC_` or commit them to GitHub. The future invoicing app must retrieve the data server-to-server, enforce rate limiting and add verified customer/VAT/pricing data.

## Deferred (intentional)
Training schedules, rider/competition screens and personnel schedules are not part of this phase.
