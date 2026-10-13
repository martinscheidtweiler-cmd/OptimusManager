# Optimus Tasks

Een zelfstandige personeels-takenapp, in `optimus-tasks/` binnen OptimusManager. De app gebruikt de bestaande **Optimus Supabase** (`rqcjcikemgcqcgxltjfe`) en nieuwe afgeschermde `optimus_task_*`-tabellen. De overige Optimus tabellen zijn niet gewijzigd.

## Huidige status (13 oktober 2026)
- **Database:** schema, rechten en RLS zijn uitgevoerd en getest. Twaalf personen zijn toegevoegd vanuit Optimus; `office@horse-bidder.com` is reeds beheerder en kan inloggen met het bestaande geverifieerde Supabase-account.
- **Webapp:** broncode staat in deze directory; automatische nieuwe Vercel-projectaanmaak is **geblokkeerd met 403 Forbidden**. Er is nog geen live Vercel-site.
- **AI backend:** Edge Function `optimus-tasks` is actief op Supabase, verwerkt alleen verzoeken van ingelogde beheerders. `OPENAI_API_KEY` moet als secret van Supabase Edge Functions aanwezig zijn.
- **WhatsApp:** 07:00 Europe/Brussels croncode bestaat, maar live verzending is **niet actief** totdat Vercel, Meta credentials, goedgekeurd template en opt-in ingesteld zijn.
- **End-to-end QA:** echte inlog, ingestuurde AI-opdracht en WhatsApp-delivery moeten nog getest worden.

## Vercel handmatig publiceren
1. Ga naar https://vercel.com/new → **Import Git Repository** → `martinscheidtweiler-cmd/OptimusManager`.
2. Projectnaam: `optimus-tasks`; **Root Directory**: `optimus-tasks`. De root-directory is essentieel: de bestaande OptimusManager-app mag niet overschreven worden.
3. Kies Other/framework null (de app is HTML en Vercel Node functions) en deploy. `api/config.js` bevat de **publieke** Supabase publishable key; de webapp kan daarom zonder private Supabase credentials werken.
4. Registreer de nieuwe website-URL als extra toegestane Auth redirect URL in Supabase → Authentication → URL Configuration. Laat bestaande URLs intact.
5. In Vercel Environment Variables, zet voor de beveiligde dagelijkse WhatsApp-job:
   - `SUPABASE_URL` = `https://rqcjcikemgcqcgxltjfe.supabase.co`
   - `SUPABASE_PUBLISHABLE_KEY` = de bestaande publieke publishable key
   - `CRON_SECRET` = het geheim waarvan de SHA256 al in `optimus_tasks_private.settings` is opgeslagen (bewaar dit geheim buiten Git)
   - `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANGUAGE` (bv. `nl`).
6. Laat bij Meta een **utility template** goedkeuren met `{{1}}` als naam en `{{2}}` als takenlijst. Vraag expliciete WhatsApp-opt-in per medewerker, met geldig E.164 telefoonnummer (`+32...`). De cron is `0 5,6 * * *` (UTC), de API controleert zelf of het 07:00 in België is.
7. Koppel voor medewerkers in de adminapp het correcte e-mailadres aan hun profiel. Medewerkers melden zich aan met dat e-mailadres en bevestigen hun mailbox.

## Techniek
Vercel web `index.html` en `app.js` gebruiken Supabase Auth rechtstreeks. Afvinken loopt via een streng scoped RPC; alleen admins mogen taken en medewerkers beheren. De AI route `/api/parse` proxyt naar Supabase Edge `optimus-tasks/api/parse`. Er is geen database service-role key nodig in de browser. De database SQL staat in `migrations/20261013_optimus_tasks.sql` en is al toegepast: niet opnieuw zonder reden uitvoeren.
