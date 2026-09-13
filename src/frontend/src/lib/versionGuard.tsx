import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * A stale app shell is the worst kind of bug: the API is new, the UI is old,
 * and nothing on screen explains why. The bundle name is fingerprinted, so a
 * cheap fetch of index.html tells us whether a newer build exists. When it
 * does, the next navigation (or the tab coming back into view) becomes a full
 * load instead of a client-side route change — the user never sees an old
 * page again, and no form in progress is interrupted.
 */
const running = () => {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  return el ? el.getAttribute('src') : null;
};

const CHECK_EVERY_MS = 60_000;

export function VersionGuard() {
  const location = useLocation();
  const lastCheck = useRef(0);
  const outdated = useRef(false);
  const current = useRef<string | null>(null);

  useEffect(() => { current.current = running(); }, []);

  const check = async () => {
    if (outdated.current || !current.current) return;
    if (Date.now() - lastCheck.current < CHECK_EVERY_MS) return;
    lastCheck.current = Date.now();
    try {
      const html = await (await fetch('/index.html', { cache: 'no-store', credentials: 'omit' })).text();
      const m = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/);
      if (m && m[0] !== current.current) outdated.current = true;
    } catch { /* offline or blocked — try again later */ }
  };

  // A route change while outdated becomes a real page load of the new build.
  useEffect(() => {
    if (outdated.current) { window.location.replace(location.pathname + location.search); return; }
    void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Coming back to a tab that has been sitting for a while: check right away.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') { lastCheck.current = 0; void check().then(() => { if (outdated.current) window.location.reload(); }); } };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => { void check(); }, CHECK_EVERY_MS);
    return () => { document.removeEventListener('visibilitychange', onVisible); window.clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
