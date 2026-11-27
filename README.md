# Scanova Event Registration

Scanova reserves seats in Supabase PostgreSQL, issues a private QR ticket for each successful registration, and queues a confirmation email for n8n. Authorized staff use the dashboard or camera scanner to check attendees in. Scanova uses the existing Next.js App Router and React interface, Supabase Auth for staff sessions, ZXing for local QR decoding, and Resend through n8n for email.

## Run locally

1. Use the Node.js and pnpm versions in .mise.toml and run `pnpm install --frozen-lockfile`.
2. Keep the existing .env values. Complete the server configuration using [.env.example](.env.example) and [Supabase setup](SUPABASE_SETUP.md).
3. In Make, use the existing preview. In a standalone checkout without a running preview, run `pnpm dev` and open the address printed by Next.js.
4. Sign in through **Manage events**, create an event in the dashboard, and set an open registration window. Check the event in the public catalog.
5. Import [the n8n workflow](n8n/scanova-registration-confirmation.json) and configure the app and provider credentials as described in [n8n setup](n8n/N8N_SETUP.md).

The home page and event catalog can be served as static pages. They load current event availability from the runtime API. Registration and staff operations require a Next.js server, including on a production deployment. Payload and the Figma-managed CMS routes are separate from Scanova’s event registry.

## Checks

- Run `pnpm exec tsc --noEmit --incremental false` for type checking.
- Run `figma make verify-deploy` inside the Make environment and open the public home and catalog routes from the production output.
- With a loopback preview connected to Supabase and the n8n URL unset, run `node --env-file=.env scripts/verify-registration.mjs`. It creates isolated fixture events, verifies real records and QR tickets, tests simultaneous registrations, and removes fixtures. Set `SCANOVA_TEST_ORIGIN` if the preview uses a port other than 3000.
- Follow the staff, physical-camera, and email checks in the [API documentation](API_DOCUMENTATION.md) and [n8n setup](n8n/N8N_SETUP.md) before sharing a registration link.
