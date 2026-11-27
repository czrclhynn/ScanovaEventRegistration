# Supabase setup

## Connection and migration

Use the existing PostgreSQL values in .env. Download the public CA certificate from the project's Supabase Database Settings and set `SUPABASE_CA_FILE` or `SUPABASE_CA_CERT`. The connection verifies the hostname and trust chain. On an IPv4-only host use the session pooler configuration from the Supabase **Connect** panel. Inject the connection values through the deployment’s server-side secret mechanism. [Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres)

The SQL files under [supabase/migrations](supabase/migrations) are ordered migrations. Inspect existing public tables before applying the first one. It deliberately fails on conflicting table names so existing schemas cannot be silently repurposed. Apply pending migrations using your Supabase migration tooling or a verified PostgreSQL migration runner with a transaction. The configured project already has both migration versions recorded in `supabase_migrations.schema_migrations`.

Operational data uses these tables.

| Table | Relationship and rule |
| --- | --- |
| profiles | Links staff accounts to `auth.users`. A server-checked role grants access. |
| events | Stores Philippine event dates and local times, a timestamp deadline, and capacity. |
| registrations | Ties attendees to events. A partial unique index enforces one confirmed registration per normalized email per event. Each request ID is unique within an event. |
| qr_tickets | Ties tickets to the same event and registration through a composite foreign key. One active ticket is allowed. The database stores a SHA-256 digest. |
| checkin_logs | Ties each check-in to the ticket, event, registration, and staff profile. A unique constraint serializes duplicate attendance. |
| email_logs | Tracks provider delivery attempts, retry state, and leases so duplicate webhook executions share an idempotency key. |
| audit_logs | Records check-ins and privileged event, ticket, and email actions. |
| scanova_rate_limits | Stores hashed rate-limit keys in minute buckets. The dispatch endpoint removes buckets older than one day. |

Every operational table has RLS. Web roles have no direct access to the event, attendee, ticket, attendance, email, audit, or rate-limit tables. An authenticated account can read its own staff profile. The Next.js server uses parameterized SQL. The registration function is callable only by privileged database roles and locks the selected event for all eligibility and capacity checks.

## Staff access

Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` from the project's Connect or API Keys screen. Use the Supabase Auth dashboard to invite staff or create a user with credentials. Give the corresponding Auth ID a `public.profiles` row using the SQL editor.

```sql
insert into public.profiles (id, full_name, email, role)
select id, 'Event Administrator', email, 'admin'
from auth.users
where lower(email) = lower('admin@example.invalid');
```

Replace the example name and email with the invited account. Use `staff` for scanner and limited attendee lookup access. Use `admin` for the full dashboard, event edits, CSV export, ticket revocation, and resend. Remove the profile to withdraw Scanova access. Staff login is independent of the Figma/Payload CMS session. [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data)

## Operational data

Create the first real event through Scanova’s staff dashboard. The migrations contain schema only and the isolated live test does not publish the prototype's sample event.

Set `SCANOVA_TICKET_KEY` to a randomly generated secret of at least 32 bytes, store it in the server's secret manager, and keep it stable across deployments. Each random ticket ID contributes uniqueness and the signing key makes the encoded reference unpredictable. A key change needs an explicit transition for existing tickets, since the same key is used to regenerate the QR for email retries.

Publish the event organizer’s privacy notice and set a retention period based on the organizer’s purpose. Restrict exports to authorized staff. At the end of the retention period, purge or anonymize attendee rows and related email, attendance, and ticket records through an authorized database procedure. Keep only the aggregate attendance figures needed for reporting. Document the organizer contact and deletion procedure before opening registration.
