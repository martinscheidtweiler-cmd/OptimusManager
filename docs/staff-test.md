# Optimus Tasks — testprocedure
## Mac
Controleer eerst of er geen onopgeslagen wijzigingen zijn: git status --short.
Gebruik een aparte worktree om de andere ontwikkelbranch niet te wijzigen:
```sh
git fetch origin feat/optimus-staff-integrated
git worktree add ../OptimusStaffTest origin/feat/optimus-staff-integrated
cd ../OptimusStaffTest
npm ci
npx tsc --noEmit
npm run build
npm run dev
```
Manager: http://localhost:3000/manager?tab=Staff
Telefooninterface: http://localhost:3000/staff

## Release gates
- Existing public database tables, views and RPC privileges must be audited before any staff device receives production credentials.
- Use synthetic test workers and a non-production environment first. Verify ordinary device cannot read or write unrelated tables; verify admin can manage staff; verify anonymous access is denied.
- Verify one active worker/shift/device, switching tasks closes previous entry, timer resumes after reload, end shift clears position, inactive devices denied.
- Verify GPS permission denial, loss of connectivity, stale location display and no collection after ending shift.
- Verify dashboard totals and time zone, task edits, contact dialing and messaging.
- Real contact numbers must be entered by admin; never invent.
- HTTPS is required for GPS and reliable PWA installation on Android (localhost exception applies to the phone itself, not Mac LAN IP).
- On Android Chrome open the approved HTTPS deployment /staff and use Install app or Add to Home screen.
- Screen pinning is only a test convenience. Production requires managed dedicated-device provisioning, approved dialer/SMS handling, emergency access and foreground location service with visible notification. PWA does not provide those guarantees.
- Do not reconnect Vercel or deploy until authorized.
