# Optimus Tasks

Een zelfstandige personeels-takenapp, in `optimus-tasks/` binnen OptimusManager. De app gebruikt de bestaande **Optimus Supabase** (`rqcjcikemgcqcgxltjfe`) en nieuwe afgeschermde `optimus_task_*`-tabellen. De overige Optimus tabellen zijn niet gewijzigd.

## Huidige status (13 oktober 2026)
- **Database:** schema, rechten en RLS zijn uitgevoerd en getest. Twaalf personen zijn toegevoegd vanuit Optimus; `office@horse-bidder.com` is reeds beheerder en kan inloggen met het bestaande geverifieerde Supabase-account.
- **Webapp:** in Vercel aangemaakt en production READY als project `optimusmanager-optimus-tasks`. Verwachte productiedomein: `https://optimusmanager-optimus-tasks.vercel.app`. De browser- en login-test moeten nog gebeuren.
- **AI backend:** Edge Function `optimus-tasks` is actief op Supabase, verwerkt alleen verzoeken van ingelogde beheerders. `OPENAI_API_KEY` moet als secret van Supabase Edge Functions aanwezig zijn.
- **WhatsApp:** 07:00 Europe/Brussels croncode en het Vercel `CRON_SECRET` zijn ingesteld. Live verzending is **niet actief** totdat Meta credentials, goedgekeurd template en opt-in ingesteld zijn.
- **End-to-end QA:** echte inlog, ingestuurde AI-opdracht en WhatsApp-delivery moeten nog getest worden.

## Vercel deployment
Vercel-project `optimusmanager-optimus-tasks` gebruikt GitHub `martinscheidtweiler-cmd/OptimusManager`, met root directory `optimus-tasks`; de bestaande OptimusManager-app mag niet worden overschreven.
De database-URL, publieke publishable key en beveiligde `CRON_SECRET` zijn ingesteld voor production, preview en development. Vercel Authentication is beperkt tot preview; production is toegankelijk via de eigen Supabase Auth-login.

1. Registreer de nieuwe website-URL als extra toegestane Auth redirect URL in Supabase → Authentication → URL Configuration. Laat bestaande URLs intact.
2. Vercel Environment Variables (basis is reeds ingesteld):
   - `SUPABASE_URL` = `https://rqcjcikemgcqcgxltjfe.supabase.co`
   - `SUPABASE_PUBLISHABLE_KEY` = de bestaande publieke publishable key
   - `CRON_SECRET` = het geheim waarvan de SHA256 al in `optimus_tasks_private.settings` is opgeslagen (bewaar dit geheim buiten Git)
   - `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANGUAGE` (bv. `nl`).
3. Laat bij Meta een **utility template** goedkeuren met `{{1}}` als naam en `{{2}}` als takenlijst. Vraag expliciete WhatsApp-opt-in per medewerker, met geldig E.164 telefoonnummer (`+32...`). De cron is `0 5,6 * * *` (UTC), de API controleert zelf of het 07:00 in België is.
4. Koppel voor medewerkers in de adminapp het correcte e-mailadres aan hun profiel. Medewerkers melden zich aan met dat e-mailadres en bevestigen hun mailbox.

## Techniek
Vercel web `index.html` en `app.js` gebruiken Supabase Auth rechtstreeks. Afvinken loopt via een streng scoped RPC; alleen admins mogen taken en medewerkers beheren. De AI route `/api/parse` proxyt naar Supabase Edge `optimus-tasks/api/parse`. Er is geen database service-role key nodig in de browser. De database SQL staat in `migrations/20261013_optimus_tasks.sql` en is al toegepast: niet opnieuw zonder reden uitvoeren.
