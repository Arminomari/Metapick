/**
 * Empty-profile state: instead of a white surface, the steps that make a
 * profile worth sharing. Hidden once every step is done.
 */
import { Check, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { t } from '@/lib/i18n';
import { Card } from '@/components/ds';

export interface ChecklistItem { key: string; label: string; done: boolean; to?: string; onClick?: () => void }

export function ProfileChecklist({ title, items }: { title?: string; items: ChecklistItem[] }) {
  const navigate = useNavigate();
  const left = items.filter((i) => !i.done).length;
  if (left === 0) return null;
  return (
    <Card title={title ?? t('Gör din profil komplett')}>
      <p className="ds-caption ds-muted" style={{ marginTop: -4, marginBottom: 8 }}>{items.length - left} / {items.length} {t('klart')}</p>
      <ul className="ds-checklist">
        {items.map((i) => (
          <li key={i.key} className={i.done ? 'done' : ''}>
            <button type="button" className="ds-checklist-row" disabled={i.done} onClick={() => { if (i.onClick) i.onClick(); else if (i.to) navigate(i.to); }}>
              <span className="ds-checklist-mark" aria-hidden>{i.done && <Check size={14} />}</span>
              <span className="ds-grow">{i.label}</span>
              {!i.done && <ChevronRight size={16} className="ds-muted" aria-hidden />}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
