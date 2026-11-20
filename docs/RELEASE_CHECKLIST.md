# Optimus Manager — release gates

The feature branch is **not production ready** until all gates pass. Do not merge or deploy before verifying.

## Database (staging first)
1. Apply migrations in order: 202611200001, 202611200002, 202611200003.
2. Verify clinical RLS: anonymous and ordinary users cannot read or mutate; active administrators can.
3. Verify `optimus_move_group` using an authenticated administrator. **Important:** it is SECURITY INVOKER; existing RLS must allow updates and inserts to horse_place_assignments and horses. If it does not, stop and correct policies, never switch blindly to SECURITY DEFINER.
4. Verify moving two horses together, a blocked destination, inactive horse, repeated destination, concurrent movement and rollback on a forced error.
5. Check the existing `move_horse_v2` function separately: it is SECURITY DEFINER without a visible admin check and may need security hardening before release.

## HorseID
The manager produces an **unsent, copyable review draft** after a cross-site move. It does not know establishment registration numbers or chip IDs. Site changes are not necessarily HorseID-establishment changes. Confirm mappings and chip identifiers before using the draft. No automatic email sending.

## Invoicing API
`GET /api/invoicing/horse?horse_id=<uuid>` returns only a minimal horse record and a draft-only marker. The caller must send `Authorization: Bearer <token>`.
Configure server-side environment variables (never `NEXT_PUBLIC_`):
- `OPTIMUS_INVOICING_API_TOKEN`: randomly generated secret, at least 32 characters.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase secret key, server-side only.
- `SUPABASE_URL`: project URL (optional, default currently configured).

Do not log secrets, use TLS, rotate keys, and configure rate limiting at the deployment edge. This endpoint is **read only** and does not create invoices, calculate VAT or expose customer billing records.

## Frontend verification
Run `npm ci`, `npx tsc --noEmit`, `npm run lint`, `npm run build`; review GitHub Actions. Test login, role denial, all tabs, mobile navigation, maps, touch selection, atomic moves, care entry, stock entry and sign-out.

## Deferred scope
Training schedules, personnel scheduling, competitions and rider planning remain deferred. Legacy source files may remain in the repository; do not expose their routes without a security review.
