/**
 * Toasts from code that lives outside React (the API client, stores). The
 * ToastProvider in the shell listens; when no shell is mounted (login, legal
 * pages) the event simply has no listener and those pages show errors inline.
 */
export type NotifyKind = 'success' | 'error' | 'info';
const EVT = 'vyrle:toast';

export function notify(text: string, kind: NotifyKind = 'info'): void {
  window.dispatchEvent(new CustomEvent(EVT, { detail: { text, kind } }));
}

export function onNotify(fn: (d: { text: string; kind: NotifyKind }) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent).detail);
  window.addEventListener(EVT, h);
  return () => window.removeEventListener(EVT, h);
}
