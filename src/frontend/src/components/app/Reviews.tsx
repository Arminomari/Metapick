/** Star ratings and reviews in the design system. Same hooks as before. */
import { useState } from 'react';
import { t } from '@/lib/i18n';
import { formatDate } from '@/lib/utils';
import { useSubmitReview, useMyReviewForAssignment, useUserReviews } from '@/hooks/api';
import type { ReviewDto } from '@/types';
import { Badge, Button, Card, Field } from '@/components/ds';
import { apiMessage } from './common';

export function Stars({ value, onChange, size = 20 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  return (
    <span role={onChange ? 'radiogroup' : undefined} aria-label={t('Betyg')} style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" className={`ds-star${n <= Math.round(value) ? ' on' : ''}`} style={{ fontSize: size }} disabled={!onChange} onClick={() => onChange?.(n)} aria-label={`${n} / 5`}>★</button>
      ))}
    </span>
  );
}

export function ReviewList({ summary, compact }: { summary: { averageStars: number; totalReviews: number; reviews: ReviewDto[] }; compact?: boolean }) {
  return (
    <div className="ds-stack" style={{ gap: 12 }}>
      <div className="ds-row">
        <span className="ds-title ds-num">{summary.averageStars.toFixed(1)}</span>
        <Stars value={summary.averageStars} size={18} />
        <span className="ds-caption ds-muted">{summary.totalReviews} {summary.totalReviews === 1 ? t('omdöme') : t('omdömen')}</span>
      </div>
      {!compact && summary.reviews.map((r) => (
        <div key={r.id} style={{ borderTop: '1px solid var(--ds-line)', paddingTop: 10 }}>
          <div className="ds-row ds-row--wrap">
            <Stars value={r.stars} size={14} />
            <span className="ds-caption" style={{ fontWeight: 600 }}>{r.reviewerName}</span>
            <Badge>{r.reviewerRole === 'Brand' ? t('Varumärke') : r.reviewerRole}</Badge>
            <span className="ds-caption ds-muted" style={{ marginLeft: 'auto' }}>{formatDate(r.createdAt)}</span>
          </div>
          {r.comment && <p className="ds-body ds-muted" style={{ marginTop: 4 }}>{r.comment}</p>}
        </div>
      ))}
    </div>
  );
}

/** Leave a review for the other party once the assignment is completed, and see theirs. */
export function ReviewSection({ assignmentId, revieweeUserId, completed }: { assignmentId: string; revieweeUserId: string; completed: boolean }) {
  const { data: mine, isLoading } = useMyReviewForAssignment(assignmentId);
  const { data: theirs } = useUserReviews(revieweeUserId);
  const submit = useSubmitReview();
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  if (isLoading) return null;
  const hasOwn = Boolean(mine) || done;
  const send = async () => { setError(''); try { await submit.mutateAsync({ assignmentId, stars, comment: comment || undefined }); setDone(true); } catch (e) { setError(apiMessage(e, t('Kunde inte skicka omdömet'))); } };
  return (
    <div className="ds-stack" style={{ gap: 12 }}>
      {completed && !hasOwn && (
        <Card title={t('Lämna ett omdöme')}>
          <div className="ds-stack" style={{ gap: 12 }}>
            <Stars value={stars} onChange={setStars} size={28} />
            <Field label={t('Kommentar')} error={error}><textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('Berätta om din upplevelse…')} /></Field>
            <Button onClick={() => void send()} loading={submit.isPending}>{t('Skicka omdöme')}</Button>
          </div>
        </Card>
      )}
      {hasOwn && (
        <Card title={t('Ditt omdöme')}>
          <Stars value={mine?.stars ?? stars} size={18} />
          {(mine?.comment || comment) && <p className="ds-body ds-muted" style={{ marginTop: 6 }}>{mine?.comment ?? comment}</p>}
        </Card>
      )}
      {!completed && !hasOwn && !(theirs && theirs.totalReviews > 0) && (
        <p className="ds-caption ds-muted">{t('Omdömen låses upp när samarbetet är markerat som slutfört.')}</p>
      )}
      {theirs && theirs.totalReviews > 0 && <Card title={t('Omdömen')}><ReviewList summary={theirs} /></Card>}
    </div>
  );
}
