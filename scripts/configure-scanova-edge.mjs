import { Client } from 'pg'

const [host, user, site, webhook] = process.argv.slice(2)
if (!host || !user || !site || !webhook) throw new Error('Provide the pooler host, pooler username, site URL, and n8n production webhook URL.')
if (new URL(site).protocol !== 'https:' || new URL(webhook).protocol !== 'https:') throw new Error('Both app endpoints must use HTTPS.')
const settings = {
  scanova_edge_ticket_key: process.env.SCANOVA_TICKET_KEY,
  scanova_edge_n8n_webhook_secret: process.env.N8N_WEBHOOK_SECRET,
  scanova_edge_app_url: new URL(site).origin,
  scanova_edge_n8n_webhook_url: webhook,
  scanova_edge_supabase_url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  scanova_edge_supabase_publishable_key: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
}
if (!settings.scanova_edge_ticket_key || Buffer.byteLength(settings.scanova_edge_ticket_key) < 32 ||
    !settings.scanova_edge_n8n_webhook_secret || !settings.scanova_edge_supabase_url ||
    !settings.scanova_edge_supabase_publishable_key || !process.env.DB_PASSWORD) {
  throw new Error('Required Scanova credentials are missing.')
}
const client = new Client({
  host, user, port: 5432, database: process.env.DB_DATABASE || 'postgres', password: process.env.DB_PASSWORD,
  ssl: { ca: process.env.SUPABASE_CA_CERT?.replace(/\\n/g, '\n'), rejectUnauthorized: true },
  connectionTimeoutMillis: 7_000,
})
try {
  await client.connect()
  await client.query('begin')
  const { rows: [access] } = await client.query(`
    select has_table_privilege('anon','vault.decrypted_secrets','select') as anon,
           has_table_privilege('authenticated','vault.decrypted_secrets','select') as authenticated
  `)
  if (access.anon || access.authenticated) throw new Error('Scanova Vault access is too broad')
  for (const [name, value] of Object.entries(settings)) {
    const { rows } = await client.query('select decrypted_secret = $2 as matches from vault.decrypted_secrets where name = $1', [name, value])
    if (!rows.length) await client.query('select vault.create_secret($1, $2)', [value, name])
    else if (!rows[0].matches) throw new Error('Existing Scanova Vault configuration differs')
  }
  await client.query('commit')
  console.log('Scanova Edge settings verified in Supabase Vault.')
} catch (error) {
  await client.query('rollback').catch(() => undefined)
  console.error('Scanova Vault setup failed', error.code ?? error.message)
  process.exitCode = 1
} finally {
  await client.end()
}
