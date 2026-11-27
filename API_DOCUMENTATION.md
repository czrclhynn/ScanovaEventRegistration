# Scanova API

Routes are under `/api/scanova`. POST endpoints accept JSON. Browser mutations require the app's origin. API responses are uncached and errors use `{ "code": "...", "message": "..." }`.

## Public

- **GET /events** returns `{ events }` with names, dates, venues, registration status, capacity, and confirmed and available counts.
- **POST /registrations** accepts `eventId`, `requestId`, `name`, `email`, `organization`, `phone` in international format, and `consent: true`. It returns **201** with `{ ticket }` containing the event, attendee details, ticket ID, and PNG data URL. A stable, randomly generated request ID retries the identical submission without reserving another seat. Keep that ID and the QR confidential.

Registration errors include **400** for invalid fields, **404** for an unknown event, **409** with `registration_closed`, `event_full`, `duplicate_registration` or `request_conflict`, **429** for rate limiting, and **503** for an unavailable dependency.

## Staff and administrators

| Method and path | Request and result |
| --- | --- |
| POST /staff/login | `{ email, password }`. Establishes a server-only Supabase session cookie and returns the staff profile. |
| POST /staff/logout | Clears the local session. |
| GET /staff/session | Returns the current authorized staff profile. |
| GET /staff/events | Lists events staff can use. Administrators also see archived events. |
| GET /staff/checkin-roster | Requires `eventId`. Returns attendance counts. |
| POST /staff/checkin-roster | Accepts `{ eventId, search }`. Returns counts and up to 10 matching attendees with only manual verification fields. |
| POST /staff/dashboard | Administrator only. Requires `eventId`. Optional `search`, `filter` (`all`, `checked`, `waiting`), and one-based `page` return up to 10 attendees with statistics and recent trends. |
| POST /staff/export | Administrator only. Accepts the dashboard filters and returns the matching attendees for a CSV download. |
| POST /staff/events | Administrator only. Accepts `name`, `description`, `venue`, `date`, `start`, `end`, `deadline`, `capacity`, and `status`. Dates and times are Philippine local time. Add `id` to edit an event. |
| POST /staff/checkin | Accepts `{ eventId, reference, manual? }`. Reference is the scanned QR text or, with `manual: true`, the ticket UUID found through the staff dashboard. Returns `checked_in`, `already_checked_in`, `invalid_ticket`, `event_mismatch`, or `revoked_ticket`. |
| POST /staff/revoke | Administrator only. Accepts `{ ticketId }`. |
| POST /staff/resend | Administrator only. Accepts `{ registrationId }` for an active ticket after a definitive provider rejection. |

Missing sessions return **401**. A role mismatch returns **403**. On-site, select the event, use **Start Scanner**, allow camera permission, and check that the video stops when **Stop Scanner** is pressed. Test repeated scans, revoked tickets, the wrong event, denied permission, and manual verification. Confirm the dashboard counts update after checking in.

## Automation

All routes require the `x-scanova-secret` header. See [n8n setup](n8n/N8N_SETUP.md) for request examples and test procedures. The backend records actual provider acceptance through the callback and retries uncertain outcomes using the original delivery ID.
