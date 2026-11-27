export class ScanovaRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export async function scanova<T>(path: string, data?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const response = await fetch('/api/scanova/' + path, {
    cache: 'no-store',
    signal,
    ...(data === undefined ? {} : {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  })
  const result = await response.json()
  if (!response.ok) throw new ScanovaRequestError(response.status, result.message || 'Scanova is temporarily unavailable.')
  return result
}
