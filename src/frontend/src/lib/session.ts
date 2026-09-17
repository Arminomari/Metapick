/**
 * Small session helpers shared by the API client, the route guards and the
 * login page: where a role lives, where to send someone after login, and the
 * "your session expired" hand-off between the 401 handler and /login.
 */
const K_EXPIRED = 'vyrle-session-expired';
const K_RETURN = 'vyrle-return-to';

export const homeFor = (role: string | null | undefined): string =>
  role === 'Admin' ? '/admin' : role === 'Brand' ? '/brand' : '/creator';

/** Remember the page a logged-out visitor was trying to reach. */
export function rememberReturnTo(path: string): void {
  if (!path || path === '/' || path.startsWith('/login') || path.startsWith('/register')) return;
  try { sessionStorage.setItem(K_RETURN, path); } catch { /* private mode */ }
}

/** The session died mid-use: say so on the login page and come back here afterwards. */
export function markSessionExpired(path: string): void {
  try { sessionStorage.setItem(K_EXPIRED, '1'); } catch { /* private mode */ }
  rememberReturnTo(path);
}

/** Read-and-clear, so the notice shows once. */
export function takeSessionExpired(): boolean {
  try {
    const v = sessionStorage.getItem(K_EXPIRED) === '1';
    sessionStorage.removeItem(K_EXPIRED);
    return v;
  } catch { return false; }
}

/** Where to land after login: back where they were, if that page belongs to their role. */
export function postLoginPath(role: string | null | undefined): string {
  const home = homeFor(role);
  let back: string | null = null;
  try { back = sessionStorage.getItem(K_RETURN); sessionStorage.removeItem(K_RETURN); } catch { /* private mode */ }
  return back && (back === home || back.startsWith(home + '/') || back.startsWith(home + '?')) ? back : home;
}
