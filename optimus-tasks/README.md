# Optimus Tasks

Standalone staff task app using **existing Optimus Supabase** (isolated `optimus_task_*` tables) and Vercel. Includes authenticated admin and staff views, AI parsing endpoint, browser dictation, task status, optional Meta WhatsApp Cloud API 07:00 Europe/Brussels digest.

## Provisioning
- Apply `migrations/20261013_optimus_tasks.sql` to the Optimus Supabase project.
- Write SHA-256 hashes of random one-time tokens to `optimus_tasks_private.settings` as `setup_hash` and `cron_hash`.
- Set Vercel env `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `CRON_SECRET`, and `OPENAI_API_KEY` (for AI).
- For WhatsApp also add `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANGUAGE`.
- Approve a Meta utility template body with `{{1}}` (recipient's name) and `{{2}}` (daily numbered tasks). Have recipients opt in and set full E.164 numbers. Schedule is 05:00/06:00 UTC; endpoint sends only in the 07:00 Europe/Brussels hour, accommodating daylight saving time.
- The first admin signs up, verifies email, and uses the one-time setup code. Subsequent staff sign up with the email set by the admin.

No database service-role credentials are needed or exposed to the browser. Staff task completion uses scoped RPC. AI requires admin authentication. The Vercel cron is protected by `CRON_SECRET`.
