import { useEffect } from 'react';

const BASE = 'VYRLE';

/** Per-page document title: "Intäkter · VYRLE". Tabs, history and screen readers all read it. */
export function useTitle(title?: string | null): void {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE}` : BASE;
  }, [title]);
}
