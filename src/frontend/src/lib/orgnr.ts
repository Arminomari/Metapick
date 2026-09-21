/**
 * Swedish organisationsnummer: ten digits with a Luhn (mod-10) check digit.
 * Mirrors the server rule (Domain/Common/OrgNumber.cs). Passing this check
 * only means the number *can* exist; verification is a registry lookup that
 * happens on the server after registration.
 */
export function orgNrDigits(raw: string): string | null {
  let d = raw.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('16')) d = d.slice(2);
  return d.length === 10 ? d : null;
}

export function isValidOrgNr(raw: string): boolean {
  const d = orgNrDigits(raw);
  if (!d) return false;
  // Third digit at least 2: separates company numbers from personal numbers.
  if (Number(d[2]) < 2) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let n = Number(d[i]);
    if (i % 2 === 0) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}
