import 'server-only'
import { createHmac } from 'node:crypto'
import QRCode from 'qrcode'
import { ApiError, hash } from './http'

export function ticketToken(ticketId: string) {
  const key = process.env.SCANOVA_TICKET_KEY
  if (!key || Buffer.byteLength(key) < 32) throw new ApiError(503, 'ticket_key_missing', 'Ticket issuance is temporarily unavailable.')
  return 'scn1_' + createHmac('sha256', key).update(ticketId).digest('base64url')
}

export async function ticketPng(ticketId: string, expectedHash?: string) {
  const token = ticketToken(ticketId)
  if (expectedHash && hash(token) !== expectedHash) {
    throw new ApiError(503, 'ticket_key_mismatch', 'The ticket signing key is unavailable.')
  }
  return QRCode.toBuffer(token, { type: 'png', scale: 15, margin: 4, errorCorrectionLevel: 'M' })
}
