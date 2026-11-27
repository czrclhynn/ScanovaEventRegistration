# Scanova confirmation workflow

## Import and configure

1. Import [scanova-registration-confirmation.json](scanova-registration-confirmation.json) into n8n with **Import from File**.
2. Create an n8n **Header Auth** credential with header name `x-scanova-secret`. Store the same randomly generated value in the app's `N8N_WEBHOOK_SECRET`. Select this credential on the webhook, ticket retrieval, QR, status, retry status, and dispatcher nodes.
3. Replace `https://scanova.example.com` with the deployed HTTPS app origin in the four static app request URLs and the **Obtain QR Image** URL expression. Replace the sender in **Format Confirmation Email** with your verified Resend sender.
4. Create another n8n **Header Auth** credential named for Resend. Set the header name to `Authorization` and its value to `Bearer` followed by your Resend API key. Select it on **Send Confirmation Email**. The node uses the Resend send API so the delivery's idempotency key and inline attachment can be passed together. [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys) · [Inline QR attachments](https://resend.com/docs/dashboard/emails/embed-inline-images)
5. Publish or activate the workflow and copy the webhook's **Production URL** to `N8N_WEBHOOK_URL`. The same workflow includes a once-per-minute retry trigger.

## Contract

The webhook receives a POST with only the delivery UUID. Use the [dummy payload](sample-webhook-payload.json) to check that a well-formed but unclaimed delivery stops before sending. The application's webhook POST and back-channel requests all use TLS in production. Webhook acceptance means n8n received the notification.

Attendees use the public registration form without an API key. Once Scanova confirms a registration and issues the QR ticket, it queues the email and calls n8n. The webhook secret and the Resend sending key are configured once in their respective credential settings.

The Resend test sender can be used for a test to the email on the Resend account. To send to event attendees, set the formatter's From address to one on a domain verified for sending in Resend. [Resend test sender limits](https://resend.com/changelog/improved-logs-visibility)

| Backend request | Expected response |
| --- | --- |
| POST /api/scanova/automation/claim with `{ "deliveryId": "uuid" }` | `claimed: false` stops a duplicate or ineligible send. `claimed: true` includes a short-lived `claim_token`, the recipient, name, and event facts. |
| GET /api/scanova/automation/qr?deliveryId=… with `x-scanova-claim` | `image/png`. The workflow receives binary data and converts it to the base64 content of a CID attachment. |
| POST /api/scanova/automation/status with `{ "deliveryId": "uuid", "claim": "uuid", "outcome": "sent", "providerReference": "provider-id" }` | `{ "recorded": true }` for the current active claim. `rejected` records a definitive provider error. `retry` clears the claim and leaves delivery pending for a durable retry. |
| POST /api/scanova/automation/dispatch | Reserves due deliveries atomically and returns `{ "dispatched": number }`. |

Resend acceptance records `sent` and a provider ID. For inbox placement or later bounces, consult the provider’s dashboard. The workflow reuses the delivery ID for retries inside the provider’s idempotency window. The app limits automatic attempts and treats unknown outcomes separately from definitive rejections. Review the provider dashboard before sending again after an unknown outcome. The workflow disables saving execution data because ticket and contact details pass through its nodes.

## Acceptance checks

1. In staging, use an event with at least one slot and an email inbox you control. Submit a registration. Confirm the QR ticket is visible in the browser and the embedded QR works in the received email. Verify its log changes from pending to sent with a provider ID.
2. Replay the same delivery UUID while it is in progress and after the callback. Verify the provider shows one send.
3. Use an invalid provider credential in a staging copy. Confirm the registration remains confirmed with a usable QR, the email is marked failed, and the administrator can queue a retry after fixing the credential.
4. Exercise an unavailable webhook or provider timeout. Verify email remains pending through retry and that the provider never sends twice for that delivery ID.
5. Try the wrong header and an invalid delivery payload, and confirm no email is sent. Use only authorized fixture addresses.
