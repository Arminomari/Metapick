/**
 * Live input masks — format while the user types so the expected shape
 * is impossible to miss. All masks are idempotent (mask(mask(x)) === mask(x)),
 * safe to run on every keystroke.
 */

/** Swedish organisationsnummer: 556677-8899 (dash inserted automatically). */
export function maskOrgNr(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 10);
  return d.length > 6 ? `${d.slice(0, 6)}-${d.slice(6)}` : d;
}

/** Swedish mobile for Swish: 070-123 45 67. */
export function maskSwishNumber(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 10);
  let out = d.slice(0, 3);
  if (d.length > 3) out += '-' + d.slice(3, 6);
  if (d.length > 6) out += ' ' + d.slice(6, 8);
  if (d.length > 8) out += ' ' + d.slice(8, 10);
  return out;
}

/** Bank clearing + account: digits, spaces and dashes only (formats vary per bank). */
export function maskBankAccount(v: string): string {
  return v.replace(/[^\d\s-]/g, '').replace(/\s{2,}/g, ' ').slice(0, 30);
}

/** Phone: digits, one leading +, light separators. */
export function maskPhone(v: string): string {
  const cleaned = v.replace(/[^\d+\s-]/g, '');
  return (cleaned.startsWith('+') ? '+' + cleaned.slice(1).replace(/\+/g, '') : cleaned.replace(/\+/g, '')).slice(0, 20);
}
