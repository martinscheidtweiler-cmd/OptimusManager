# Optimus Tasks — controle en testprocedure

Deze testprocedure geldt voor de native Android-app in `android-staff/` en het personeelsdashboard. Werk op branch `codex/optimus-tasks-android`; productie wordt pas aangepast na expliciete vrijgave.

## Automatische controles

De GitHub Actions-workflow `Optimus Tasks Android build` voert op de featurebranch en pull request uit:

- Android debug-APK compileren (API 35)
- datum- en zomertijdtests uitvoeren
- TypeScript controleren, linten en de Next.js-app bouwen

De Supabase pgTAP-test staat in `supabase/tests/staff_phone.test.sql`. Voer die uitsluitend uit op een lokale of wegwerp-testdatabase met de staff-schema's en beide nieuwe migraties:

```sh
supabase start
supabase db reset
supabase test db
```

Gebruik deze commando's nooit met een productieproject gekoppeld. De pgTAP-test maakt tijdelijke testmedewerkers en testshifts aan en rolt die daarna terug.

## Web- en databasecontroles

- Controleer dat ingelogde managers werknemers, locaties, taken, contacten en gekoppelde telefoons kunnen beheren.
- Controleer dat anonieme clients de staff-tabellen, shiftgeschiedenis, GPS-posities, pairinggegevens en actiebewijzen niet rechtstreeks kunnen lezen.
- Controleer dat de telefoon alleen via de code-beveiligde `staff_phone`-RPC werkt; de admin-RPC blijft ontoegankelijk voor `anon`.
- Herhaal `begin` en `task` met hetzelfde verzoek-ID; er mag geen dubbele shift of taak ontstaan.
- Controleer een dienst die over middernacht loopt, totalen op Brusselse kalenderdagen, filters, taakwijzigingen en de apparaattijdlijn.
- Controleer dat blokkeren van een toestel zijn lopende taak/dienst afsluit en de laatst bekende locatie wist.

## Testen op een Android-toestel

Gebruik de installatie- en koppelstappen in [ANDROID_STAFF_SETUP.md](ANDROID_STAFF_SETUP.md). Test op een reserve- of testtelefoon:

- Koppelen, dienst starten, taak kiezen/wisselen, taak stoppen, dienst beëindigen en opnieuw openen.
- Herhaal acties zonder netwerk, sluit en heropen de app, herstel internet en controleer dat elke actie eenmaal is gesynchroniseerd.
- Test GPS met nauwkeurige en benaderde toestemming, toestemming geweigerd, meldingen geweigerd, scherm uit, batterijbesparing, locatie uit en dienst beëindigd.
- Test bellen en sms openen op het echte toestelmodel.
- Test kioskmodus, herstart, in-/uitstappen en herstelprocedure uitsluitend op een reserveapparaat dat als test-device-owner is ingericht.
- Installeer een volgende release over de huidige installatie om te controleren dat de ondertekeningssleutel gelijk blijft.

De CI-build kan compilatie controleren, maar niet de GPS-werking bij scherm uit, fabrikantspecifieke batterijbeperkingen, device-owner/kioskherstel of installatie op een fysiek toestel.

## Vrijgavevoorwaarden

- Pas de staff-migraties eerst toe op de goedgekeurde database en voer de pgTAP- en handmatige controles uit.
- Beoordeel de bestaande RLS-waarschuwingen voor de overige Optimus-tabellen en stel beleid vast dat bij de manager-schermen past. RLS aanzetten zonder geteste policies kan bestaande functionaliteit blokkeren.
- Configureer en bewaar de bedrijfsondertekeningssleutel veilig voordat de APK als updateerbare bedrijfsrelease wordt verspreid.
- Geen productie-deployment of merge naar `main` zonder expliciete goedkeuring.
