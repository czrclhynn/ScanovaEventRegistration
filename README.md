# Scanova Event Registration

Scanova is a full-stack event registration and attendance system for seminars, workshops, and community events. It provides public seat reservations, private QR tickets, staff authentication, physical-camera check-in, attendee dashboards, CSV export, ticket revocation, and confirmation-email delivery.

The application uses a Next.js App Router interface and two complementary data platforms:

- **Supabase PostgreSQL** stores events, registrations, QR tickets, check-in records, email delivery state, audit records, staff profiles, and rate limits.
- **Payload CMS** provides the Figma-managed `/admin` CMS, media, folders, tags, and an event CMS collection.

The public registration and operations workflow is primarily backed by Supabase. Payload CMS is kept as a separate editorial/admin surface and must not be confused with the staff authorization used by the scan and dashboard features.

## Features

### Public registration

- Browse the event catalog and available seat counts.
- Select an open event and submit name, email, organization, and international-format phone number.
- Require explicit consent for registration and attendance processing.
- Reserve seats transactionally so two concurrent requests cannot overbook a final slot.
- Prevent duplicate confirmed registrations for the same email and event.
- Accept a stable request ID to make a browser retry idempotent.
- Return a signed PNG QR ticket immediately after a successful reservation.
- Download the ticket or QR image and add the event to a calendar.

### Staff operations

- Authenticate through Supabase Auth with a local, HTTP-only session cookie.
- Separate `staff` and `admin` roles.
- Search attendees and filter the roster by all, checked-in, or waiting status.
- Review registration, ticket, email-delivery, and attendance status.
- Scan tickets with a phone or laptop camera using ZXing.
- Fall back to manual ticket-ID verification.
- Prevent duplicate attendance and detect already checked-in, revoked, mismatched, or invalid tickets.
- Keep an attendance trend and live dashboard statistics.
- Create and edit events as an administrator.
- Export matching attendee rows to a formula-safe CSV.
- Revoke active tickets.
- Requeue confirmation email after a definitive provider rejection.

### Confirmation delivery

- Queue confirmation delivery in PostgreSQL as soon as registration succeeds.
- Dispatch to n8n with a shared automation secret.
- Claim and retry deliveries atomically.
- Limit automatic attempts and use exponential scheduling.
- Fetch the QR as an image inside a short-lived delivery claim.
- Report accepted, rejected, or uncertain delivery outcomes back to the application.
- Keep the registration and QR usable even when email delivery fails.

## System architecture

```text
Visitor / Staff browser
         |
         v
Next.js App Router
  |-- Public event and registration screens
  |-- Staff dashboard and QR scanner
  `-- /api/scanova/* route handler
         |
         +--> Supabase Auth (staff sessions)
         |
         +--> Supabase PostgreSQL
         |      |-- events
         |      |-- registrations
         |      |-- qr_tickets
         |      |-- checkin_logs
         |      |-- email_logs
         |      |-- audit_logs
         |      `-- scanova_rate_limits
         |
         `--> n8n webhook
                |
                `--> Resend confirmation email
```

The main UI is in `src/app/(frontend)`. The custom `/api/scanova/[...segments]` route forwards to the direct Node.js implementation or, when enabled, to the supplied Supabase Edge relay. Payload's managed routes remain under `src/app/(payload)` and should not be edited directly.

### Registration flow

1. The browser submits registration data to `POST /api/scanova/registrations`.
2. The server validates the origin, body size, JSON shape, fields, consent, and rate limits.
3. PostgreSQL calls `scanova_register` and locks the event row.
4. The database checks event status, deadline, duplicate email, request-ID idempotency, and capacity.
5. A confirmed registration gets an active QR ticket.
6. The QR reference is derived from a random ticket ID and `SCANOVA_TICKET_KEY`; only a SHA-256 digest is stored in PostgreSQL.
7. An email-delivery record is created for n8n.
8. The browser receives the attendee details and PNG QR data URL.
9. n8n claims the delivery, retrieves the QR, sends through Resend, and reports the final provider state.

### Check-in flow

1. Staff sign in through Supabase Auth.
2. The server loads the matching `public.profiles` row and role.
3. Staff select an event and start the camera scanner or use manual verification.
4. The scanner sends the QR token or ticket UUID to `POST /api/scanova/staff/checkin`.
5. PostgreSQL verifies the token, ticket status, event, registration state, and attendance uniqueness.
6. First check-in creates a `checkin_logs` row and audit entry. A repeated scan returns `already_checked_in`.

## Technology stack

| Area | Technology |
| --- | --- |
| Framework | Next.js 16 App Router, React 19 |
| Language | TypeScript |
| CMS | Payload 4 beta with `@payloadcms/figma` |
| Database | Supabase-hosted PostgreSQL |
| Staff auth | Supabase Auth plus `@supabase/ssr` |
| QR generation | `qrcode` |
| Camera QR decoding | `@zxing/browser` |
| Email automation | n8n |
| Email provider | Resend |
| Styling | Tailwind CSS v4 |
| Package manager | pnpm |
| Runtime | Node.js 24 or 26+, matching `.mise.toml` |

## Repository layout

```text
src/app/(frontend)/       Public and staff React screens
src/app/(frontend)/api/   Next.js Scanova API proxy
src/app/(payload)/        Managed Payload CMS/admin routes
src/collections/          Payload collection definitions
src/lib/scanova/          Database, auth, registration, ticket, email, and API logic
src/lib/payload.ts        Shared Payload lookup utilities
src/payload.config.ts     Figma-managed Payload configuration
supabase/migrations/      Ordered Scanova PostgreSQL migrations
supabase/functions/       Optional Supabase Edge relay implementation
scripts/                  Live registration verification and edge packaging
n8n/                      Confirmation workflow and setup documentation
public/                   Static public assets
.figma/make/              Figma Make lifecycle scripts
.env.example              Runtime environment-variable template
```

Do not directly edit files under `src/app/(payload)`. That route tree is managed by Payload.

## Prerequisites

- Node.js `24.22.3` or another compatible version allowed by `package.json`
- pnpm 10
- A Supabase project
- Supabase Auth users for staff
- A deployed HTTPS origin for staff camera access and browser mutations
- Optional: n8n and a verified Resend sender
- Optional: Figma Make for preview, CMS, and deployment integration

The repository pins Node.js and pnpm in `.mise.toml`.

## Local setup

1. Install the pinned toolchain:

   ```bash
   pnpm install --frozen-lockfile
   ```

2. Create a local environment file:

   ```bash
   cp .env.example .env
   ```

3. Fill in the Supabase database, Auth, application URL, ticket signing key, and optional n8n values.

4. Apply the Supabase migrations described in [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

5. Create at least one staff profile.

6. Start the app:

   ```bash
   pnpm dev
   ```

7. Open `http://localhost:3000` for the public site or `http://localhost:3000/admin` for Payload CMS.

Inside Figma Make, use the existing development preview instead of starting a second server. The Make lifecycle starts and manages Next.js through `.figma/make/dev`.

## Environment variables

The complete template is in [.env.example](.env.example).

| Variable | Required | Purpose |
| --- | --- | --- |
| `DB_HOST` | Yes, unless `SUPABASE_DB_URL` is used | Supabase PostgreSQL host |
| `DB_PORT` | No | PostgreSQL port, defaults to `5432` |
| `DB_DATABASE` | Yes | PostgreSQL database name |
| `DB_USERNAME` | Yes | PostgreSQL role |
| `DB_PASSWORD` | Yes | PostgreSQL password |
| `SUPABASE_DB_URL` | Alternative | Full PostgreSQL connection string |
| `SUPABASE_CA_FILE` | Recommended | Path to the public Supabase CA certificate |
| `SUPABASE_CA_CERT` | Alternative | PEM certificate, with literal `\n` sequences accepted |
| `APP_URL` | Recommended | Public HTTPS origin used for origin checks |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable API key |
| `SCANOVA_TICKET_KEY` | Yes | At least 32 bytes of signing key material |
| `N8N_WEBHOOK_URL` | Optional | n8n confirmation workflow webhook |
| `N8N_WEBHOOK_SECRET` | Optional | Shared automation bearer header credential |
| `NEXT_PUBLIC_SUPABASE_URL` | Compatibility fallback | Browser/server Supabase URL fallback |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Compatibility fallback | Supabase key fallback |

`SCANOVA_TICKET_KEY` must remain stable across deployments. Changing it invalidates existing QR tokens unless they are migrated deliberately.

Never expose `DB_PASSWORD`, `SCANOVA_TICKET_KEY`, `N8N_WEBHOOK_SECRET`, or other server credentials through `NEXT_PUBLIC_*` variables.

## Supabase setup

Follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for migrations, staff provisioning, TLS, and privacy guidance.

The migrations create:

- `profiles`
- `events`
- `registrations`
- `qr_tickets`
- `checkin_logs`
- `email_logs`
- `audit_logs`
- `scanova_rate_limits`

Important database guarantees include:

- A partial unique index allows only one confirmed registration per normalized email per event.
- A unique `(event_id, request_id)` constraint makes retries idempotent.
- The `scanova_register` function locks the event and validates status, deadline, duplicates, and capacity.
- The active-ticket index allows at most one active ticket per registration and event.
- Check-ins are unique per event and registration.
- Operational tables have RLS enabled and web roles cannot read or mutate them directly.
- The application server uses parameterized SQL.

Use the Supabase SQL editor or migration tooling to add staff profiles:

```sql
insert into public.profiles (id, full_name, email, role)
select id, 'Event Administrator', email, 'admin'
from auth.users
where lower(email) = lower('admin@example.invalid');
```

Use `staff` for scanner and roster access. Use `admin` for event creation/editing, attendee dashboard, export, revocation, and email resend.

## Running the application

```bash
pnpm dev
```

The development server listens on `0.0.0.0` and on the Make-provided `$PORT`. Do not hardcode a port.

## Public routes

| Route | Behavior |
| --- | --- |
| `/` | Main Scanova landing page and registration state |
| `/events` | Public event catalog |
| `/?event=<uuid>` | Opens the registration flow for an event |
| `/?staff=scanner` | Staff login and QR scanner |
| `/?staff=dashboard` | Administrator attendee dashboard |
| `/?staff=events` | Staff event-management entry |
| `/admin` | Payload CMS |
| `/api/scanova/*` | Public, staff, and automation API routes |

## API overview

All Scanova routes begin with `/api/scanova`. JSON mutations must use the configured application origin. API responses are uncached and errors use:

```json
{
  "code": "error_code",
  "message": "Human-readable explanation"
}
```

Public routes include:

| Method and route | Purpose |
| --- | --- |
| `GET /api/scanova/events` | List available events and live availability |
| `POST /api/scanova/registrations` | Create or retry an attendee registration |

Staff routes require a Supabase session:

| Method and route | Purpose |
| --- | --- |
| `POST /api/scanova/staff/login` | Create a staff session |
| `POST /api/scanova/staff/logout` | Clear the staff session |
| `GET /api/scanova/staff/session` | Read the authorized profile |
| `GET /api/scanova/staff/events` | List events available to staff |
| `GET /api/scanova/staff/checkin-roster` | Read check-in counts |
| `POST /api/scanova/staff/checkin-roster` | Search a manual verification roster |
| `POST /api/scanova/staff/dashboard` | Read filtered administrator dashboard data |
| `POST /api/scanova/staff/export` | Export matching attendee rows |
| `POST /api/scanova/staff/events` | Create or edit an event |
| `POST /api/scanova/staff/checkin` | Check in a scanned or manual ticket |
| `POST /api/scanova/staff/revoke` | Revoke a ticket |
| `POST /api/scanova/staff/resend` | Requeue a definitive provider rejection |

Automation routes require `x-scanova-secret` and are documented in [API_DOCUMENTATION.md](API_DOCUMENTATION.md).

## n8n and email setup

Scanova can operate without n8n: registrations remain confirmed and tickets remain usable, but email delivery stays pending.

To enable confirmation email:

1. Import `n8n/scanova-registration-confirmation.json`.
2. Configure the n8n Header Auth secret to match `N8N_WEBHOOK_SECRET`.
3. Configure Resend credentials and a verified sender.
4. Replace static app origins in the workflow with the deployed HTTPS origin.
5. Publish the workflow and set `N8N_WEBHOOK_URL` to its production webhook URL.
6. Activate the workflow's one-minute retry trigger.

Full instructions and acceptance checks are in [n8n/N8N_SETUP.md](n8n/N8N_SETUP.md).

The delivery system uses idempotency and short-lived claims, so replayed n8n requests do not create duplicate registrations or duplicate Resend sends.

## Optional Supabase Edge relay

Set `SCANOVA_EDGE_ENABLED=true` to relay Scanova API calls through `supabase/functions/scanova-api`. The edge function expects relay configuration in Supabase Vault and authenticates Next.js requests with an HMAC-derived relay token.

Keep `SCANOVA_EDGE_ENABLED` unset or false when running the normal Next.js server implementation. Database and application configuration must still be available to the implementation that is active.

## Payload CMS

Payload is available at `/admin` and uses Figma SSO for CMS editors. The CMS is configured in `src/payload.config.ts`.

Included collections are:

- `Admins`
- `Media`
- `Folders`
- `Tags`
- `Events`

The Payload `Events` collection is a CMS/event editorial model. It is separate from the operational `public.events` table used by registrations and check-in. Changes in one model do not automatically update the other.

Use the Payload setup only for its configured CMS responsibilities. Public app signup and public staff authorization are separate concerns.

## Verification and checks

Run a TypeScript check:

```bash
pnpm exec tsc --noEmit --incremental false
```

Run a production build in the Make lifecycle:

```bash
pnpm build
```

`pnpm build` runs `payload build`, which performs the integrated Payload and Next.js build.

Run the live registration verifier against an isolated loopback preview:

```bash
node --env-file=.env scripts/verify-registration.mjs
```

Set `SCANOVA_TEST_ORIGIN` if the preview is not at `http://localhost:3000`. The verifier intentionally refuses non-loopback origins and refuses to run if `N8N_WEBHOOK_URL` is configured.

It creates temporary events and registrations, verifies:

- validation and closed/expired events
- duplicate registration and request-id retry behavior
- concurrent final-slot requests and capacity
- QR generation and decoding
- persisted PostgreSQL records
- public availability counts
- optional authenticated n8n callback transitions
- cleanup of all temporary fixture rows

For a Make deployment, run `figma make verify-deploy`, inspect the route table, and visit the generated public routes. Follow the manual staff, camera, n8n, and email acceptance checks in [API_DOCUMENTATION.md](API_DOCUMENTATION.md) and [n8n/N8N_SETUP.md](n8n/N8N_SETUP.md).

## Security and operational notes

- Registration, staff, and automation endpoints use server-side validation and structured errors.
- Browser mutations require a matching origin.
- JSON request bodies are limited to 16 KB.
- Staff login and dashboard actions have database-backed rate limits.
- Staff authorization comes from Supabase Auth plus the `profiles` role row.
- QR check-in references are HMAC-signed; only ticket digests are stored.
- Revocation and attendance updates are auditable.
- n8n automation endpoints require a timing-safe shared secret.
- n8n callback claims expire after three minutes.
- Email dispatch records pending, sent, and failed states and retries uncertain outcomes.
- Deployments should run only over HTTPS.
- Camera access generally requires HTTPS or localhost.
- Staff exports contain personal data and should be restricted and retained according to the organizer's privacy policy.

## Privacy and retention

Scanova stores names, emails, organizations, phone numbers, registration timestamps, ticket IDs, attendance records, and email-delivery state.

Before production use:

- Publish the event organizer's privacy notice.
- Define an attendee-data retention period.
- Restrict dashboard and export access to authorized staff.
- Remove or anonymize old operational records using an authorized procedure.
- Document the organizer contact and data-deletion process.
- Keep aggregate reporting records only when no attendee-level record is required.

## Troubleshooting

| Problem | Check |
| --- | --- |
| Database configuration missing | Set DB fields or `SUPABASE_DB_URL`, and include the Supabase CA certificate |
| Staff login unavailable | Verify `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` and ensure the user has a `profiles` row |
| Staff gets 403 | Confirm the profile role is `staff` or `admin` |
| Registration returns 503 | Verify PostgreSQL, `SCANOVA_TICKET_KEY`, and the Supabase migration state |
| Camera does not start | Use HTTPS or localhost and allow browser camera permission |
| Browser mutation returns 403 | Set `APP_URL` or preview origin exactly to the deployed public origin |
| Email stays pending | Set the n8n URL and secret, publish the workflow, and check n8n execution logs |
| Email is failed | Review the Resend credential, verified sender, and provider dashboard |
| Existing tickets stop verifying | Check that `SCANOVA_TICKET_KEY` has not changed |
| Supabase Edge requests fail | Verify the relay secret, Edge function, Vault values, and `SCANOVA_EDGE_ENABLED` |
| Payload preview resources are blocked | Preserve the Figma `allowedDevOrigins` and server-action origin configuration |

## Reference documentation

- [Supabase setup](SUPABASE_SETUP.md)
- [API documentation](API_DOCUMENTATION.md)
- [n8n workflow setup](n8n/N8N_SETUP.md)
- [Environment template](.env.example)
