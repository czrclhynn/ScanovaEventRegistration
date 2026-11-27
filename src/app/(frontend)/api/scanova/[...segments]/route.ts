import { GET as directGet, POST as directPost, type Context } from '@/lib/scanova/router'
import { relayScanova } from '@/lib/scanova/relay'

export const runtime = 'nodejs'

export async function GET(request: Request, context: Context) {
  if (process.env.SCANOVA_EDGE_ENABLED === 'true') return relayScanova(request, (await context.params).segments)
  return directGet(request, context)
}

export async function POST(request: Request, context: Context) {
  if (process.env.SCANOVA_EDGE_ENABLED === 'true') return relayScanova(request, (await context.params).segments)
  return directPost(request, context)
}
