# OPTIMUS Stable Manager — product and migration plan

## Non-negotiable
- Existing horses, site boundaries, paddock polygons, locations, and movement history are authoritative. Do not wipe, recreate, or migrate without a verified backup.
- Mobile-first: frequent actions should require at most two deliberate interactions *after* the relevant horse/group is selected; never silently omit required veterinary or legal fields.
- No training/rider scheduling in the new primary navigation.
- No Vercel integration or production deployment before acceptance tests and explicit approval.
- Use one Supabase data source with role-based permissions and auditable changes.

## Core modules
1. **Today**: urgent follow-ups, pregnancy scans, veterinary issues, vaccinations, deworming, farrier, expected foalings and low stock.
2. **Horses**: horse identity, microchip, owner/billing customer, location, group membership, breeding/health history.
3. **Places**: retain existing satellite map, site and field geometry. Add fast mobile list and group moves. Distinguish physical field from registered HorseID establishment.
4. **Breeding**: mare cycle and scan records, insemination, stallion, pregnancy checks, embryo flushing, due-date estimate and foaling. Recommendations are reminders, not autonomous clinical decisions.
5. **Health**: vaccination, deworming, farrier, open veterinary problems, assigned vet, diagnosis, treatment plan, administration log and follow-up.
6. **Medication**: item, lot, expiry, units, location, reorder threshold, stock movements and links to veterinarian-authorized treatment.
7. **Billing integration**: read-only, authenticated API for horse, owner, dates of stay, services and chargeable events. Draft invoices belong to the separate billing system.

## Fast movement flow
- Select a pre-existing group (or select multiple horses), choose destination site/field, confirm.
- Show old/new field, registered establishment, horse count and chip numbers.
- Write each move atomically with actor, timestamp, origin, destination, and idempotency key; preserve an immutable audit trail.
- On cross-establishment moves, queue a HorseID notification entry, not a direct HorseID update.
- Aggregate notifications by day into one reviewable draft addressed to veronique@dsf.be, with horse name, microchip, previous/new establishment and https://www.horseid.be.
- Never send mail without explicit approval. Track draft/approved/sent/error states, prevent duplicate notifications and allow corrections.

## Access control
Admin: configuration, users, billing integration and approval of outbound messages.
Staff: location moves and routine records within assigned sites.
Veterinarian: authorized clinical notes and treatments.
Read-only: appropriate restricted views.
Implement Supabase RLS, audit events, server-side secret handling and least-privilege billing API.

## Implementation order
1. Audit all three existing repositories and the actual Supabase schema, record which functionality is safe to reuse.
2. Verify backup/export and permissions before migrations.
3. Implement responsive navigation and location list, test existing PlaceTab on touch devices.
4. Implement group movements with transaction, tests and notification outbox.
5. Add breeding, veterinary and medicine modules.
6. Add billing integration contract and tests.
7. Run build, mobile accessibility tests, permission tests, data integrity checks and review; only then consider merge/deployment.

## Acceptance checks
- An employee can move a group from Vremde to Sint-Katelijne-Waver using a phone without drag-and-drop.
- Moving within the same registered establishment does not create a HorseID notification.
- A cross-establishment move creates a reviewable notification with all horses, without sending email.
- Existing maps, horses and historic movements remain intact.
- Medication changes are traceable to user, horse, lot and veterinary authorization.
- The separate billing app can retrieve only authorized records.
