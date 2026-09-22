/**
 * The shared job timeline. The server (AssignmentProgress) decides the steps and
 * who the job waits for; this renders the same list for the creator and for the
 * brand, with the headline phrased for whoever is looking. Neither side can be
 * told a different story about where the job stands.
 */
import { Check, Clock } from 'lucide-react';
import { t } from '@/lib/i18n';
import { Badge, Card } from '@/components/ds';
import type { AssignmentProgress } from '@/types';

/** "om 12 h" / "om 3 dagar" for a deadline that has not passed yet. */
function until(iso: string): string | null {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const hours = Math.ceil(ms / 3_600_000);
  if (hours < 24) return `${t('om')} ${hours} h`;
  const days = Math.ceil(hours / 24);
  return `${t('om')} ${days} ${days === 1 ? t('dag') : t('dagar')}`;
}

const TONE: Record<string, 'accent' | 'warn' | 'ok' | 'neutral'> = {
  Creator: 'accent', Brand: 'accent', Vyrle: 'warn', TikTok: 'warn', Nobody: 'neutral',
};

export function ProgressTimeline({ progress, role }: { progress: AssignmentProgress; role: 'creator' | 'brand' }) {
  const headline = role === 'brand' ? progress.brandHeadline : progress.creatorHeadline;
  // "Your turn" only when the viewer is the one being waited for.
  const yours = (role === 'creator' && progress.waitingOn === 'Creator') || (role === 'brand' && progress.waitingOn === 'Brand');
  return (
    <Card>
      <div className="ds-row ds-row--wrap" style={{ alignItems: 'center', gap: 8 }}>
        <Badge tone={yours ? 'accent' : TONE[progress.waitingOn] ?? 'neutral'}>{headline}</Badge>
      </div>
      <ol className="ds-timeline">
        {progress.stages.map((s) => {
          const done = s.state === 'Done';
          const current = s.state === 'Current';
          const stopped = s.state === 'Stopped';
          const deadline = s.deadline ? until(s.deadline) : null;
          return (
            <li key={s.key} className={`ds-timeline-item${done ? ' done' : ''}${current ? ' current' : ''}${stopped ? ' stopped' : ''}`}>
              <span className="ds-timeline-mark" aria-hidden>{done ? <Check size={13} /> : current ? <Clock size={13} /> : null}</span>
              <div className="ds-grow" style={{ minWidth: 0 }}>
                <div className="ds-timeline-label">{t(s.label)}</div>
                {(s.hint || deadline) && (
                  <div className="ds-timeline-hint">
                    {s.hint ? t(s.hint) : null}
                    {deadline ? <> {s.hint ? '· ' : ''}{t('senast')} {deadline}</> : null}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
