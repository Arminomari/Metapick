/**
 * Small app-level helpers shared by every screen: the "…" menu, the
 * notifications bell, error and loading fallbacks. No data logic.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MoreHorizontal } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useNotifications } from '@/hooks/api';
import { t } from '@/lib/i18n';
import { BottomSheet, Button, Card, EmptyState, IconButton, ListRow, SheetMenu } from '@/components/ds';

export interface MenuItem { label: string; icon?: React.ReactNode; onClick?: () => void; to?: string; danger?: boolean; hidden?: boolean }

/** A 44 px "…" button that opens a bottom sheet with the item's secondary actions. */
export function MoreMenu({ items, label = t('Mer'), title }: { items: MenuItem[]; label?: string; title?: string }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const visible = items.filter((i) => !i.hidden);
  if (visible.length === 0) return null;
  return (
    <>
      <IconButton label={label} onClick={() => setOpen(true)}><MoreHorizontal /></IconButton>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={title ?? label}>
        <SheetMenu>
          {visible.map((i) => (
            <ListRow key={i.label} leading={i.icon} title={<span style={i.danger ? { color: 'var(--ds-bad)' } : undefined}>{i.label}</span>} chevron={false}
              onClick={() => { setOpen(false); if (i.to) navigate(i.to); else i.onClick?.(); }} />
          ))}
        </SheetMenu>
      </BottomSheet>
    </>
  );
}

/** Bell with unread count; the notifications screen is one tap away on every screen. */
export function NotifBell() {
  const { role } = useAuthStore();
  const navigate = useNavigate();
  const { data } = useNotifications(true);
  const n = data?.totalCount ?? 0;
  return <IconButton label={t('Notiser')} badge={n} onClick={() => navigate(role === 'Brand' ? '/brand/notifications' : '/creator/notifications')}><Bell /></IconButton>;
}

export function ErrorCard({ title, message, retry }: { title?: string; message?: string; retry?: () => void }) {
  return (
    <Card>
      <EmptyState title={title ?? t('Något gick fel')} description={message} action={retry ? <Button variant="secondary" onClick={retry}>{t('Försök igen')}</Button> : undefined} />
    </Card>
  );
}

/** Reads the message the API sends back, or falls back to the given text. */
/**
 * The message a person should read. Two shapes reach us:
 * our own envelope ({ error: { message } }), and ASP.NET's validation
 * ProblemDetails, whose `errors` dictionary holds the real reasons while
 * `title` is only "One or more validation errors occurred." Reading the
 * dictionary is what turns that into something a brand can act on.
 */
export function apiMessage(err: unknown, fallback: string): string {
  const e = err as {
    response?: { data?: { error?: { message?: string; details?: string[] }; title?: string; errors?: Record<string, string[] | string> } };
    message?: string;
  };
  const data = e?.response?.data;
  const api = data?.error;
  if (api?.details?.[0]) return api.details[0];
  if (api?.message) return api.message;

  const fields = data?.errors;
  if (fields && typeof fields === 'object') {
    // Duplicates are common: the framework and FluentValidation both complain.
    const seen = new Set<string>();
    for (const value of Object.values(fields)) {
      for (const message of Array.isArray(value) ? value : [value]) {
        if (typeof message === 'string' && message.trim()) seen.add(message.trim());
      }
    }
    if (seen.size) return [...seen].join(' ');
  }

  return data?.title ?? fallback;
}

/** Relative time in the app's own short form. */
export function ago(iso: string): string {
  const s = Math.floor((Date.now() - +new Date(iso)) / 1000);
  if (s < 60) return t('nyss');
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${t('tim')}`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} ${t('dgr')}`;
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

/** Days until a date, or null when it has passed. */
export function daysLeft(iso?: string | null): number | null {
  if (!iso) return null;
  const d = Math.ceil((+new Date(iso) - Date.now()) / 86400000);
  return d >= 0 ? d : null;
}
