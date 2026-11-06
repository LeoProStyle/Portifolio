// Client IP for the login throttle key (SF02 RF07) and the audit trail (SF03 RF03).
// On Vercel the platform sets x-forwarded-for; its first value is the client.
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for') ?? '';
  const first = forwarded.split(',')[0]?.trim() ?? '';
  return first || 'unknown';
}
