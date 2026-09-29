export type Metric = { key: string; value: number; unit?: string | null; isDerived?: boolean }

export function constantTimeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left), b = new TextEncoder().encode(right)
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i]
  return result === 0
}
export function localDate(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}
export async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}
