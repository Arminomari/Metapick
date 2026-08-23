import { useState } from 'react';
import type { CSSProperties } from 'react';
import { StarRating } from './StarRating';
import { useSubmitReview, useMyReviewForAssignment, useUserReviews } from '@/hooks/api';
import type { ReviewDto } from '@/types';
import { formatDate } from '@/lib/utils';
import { t } from '@/lib/i18n';

const box: CSSProperties = {
  border: '1px solid rgba(241,168,143,.25)', borderRadius: 16, padding: '16px clamp(12px, 4vw, 18px)',
  background: 'linear-gradient(160deg,#fff,#FFF9F5)', minWidth: 0,
};
const mutedTx: CSSProperties = { fontSize: 13, color: 'var(--muted)', lineHeight: 1.55, overflowWrap: 'anywhere' };

const roleLabel = (role: string) => (role === 'Brand' ? t('Varumärke') : role);

// ── Submit / display own review for an assignment ──────
interface ReviewSectionProps {
  assignmentId: string;
  revieweeUserId: string;
  assignmentCompleted: boolean;
}

export function ReviewSection({ assignmentId, revieweeUserId, assignmentCompleted }: ReviewSectionProps) {
  const { data: existingReview, isLoading } = useMyReviewForAssignment(assignmentId);
  const { data: allReviews } = useUserReviews(revieweeUserId);
  const submit = useSubmitReview();
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await submit.mutateAsync({ assignmentId, stars, comment: comment || undefined });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? t('Kunde inte skicka omdömet'));
    }
  };

  if (isLoading) return null;

  const hasOwn = Boolean(existingReview) || submitted;
  const hasIncoming = Boolean(allReviews && allReviews.totalReviews > 0);

  return (
    <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
      {/* Submit form — only when completed and no review yet */}
      {assignmentCompleted && !hasOwn && (
        <form onSubmit={handleSubmit} style={box}>
          <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 10 }}>{t('Lämna ett omdöme')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>{t('Betyg')}</span>
            <StarRating value={stars} onChange={setStars} />
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder={t('Berätta om din upplevelse…')}
            style={{
              width: '100%', borderRadius: 13, border: '1px solid rgba(241,168,143,.3)',
              background: 'rgba(255,255,255,.8)', padding: '11px 13px', fontSize: 13.5,
              fontFamily: 'inherit', color: '#0B0F17', resize: 'vertical', lineHeight: 1.5,
            }}
          />
          {error && <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 600, color: '#cf4b4b' }}>{error}</div>}
          <button
            type="submit"
            disabled={submit.isPending}
            className="btn-apply"
            style={{ width: 'auto', maxWidth: '100%', padding: '10px 22px', marginTop: 12 }}
          >
            {submit.isPending ? t('Skickar…') : t('Skicka omdöme')}
          </button>
        </form>
      )}

      {/* Own submitted review */}
      {hasOwn && (
        <div style={box}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{t('Ditt omdöme')}</div>
            {submitted && !existingReview && <span style={{ fontSize: 12, fontWeight: 700, color: '#2f7d52' }}>✓ {t('Tack för ditt omdöme!')}</span>}
          </div>
          <div style={{ marginTop: 8 }}>
            <StarRating value={existingReview?.stars ?? stars} readonly size="sm" />
          </div>
          {(existingReview?.comment || comment) && (
            <p style={{ ...mutedTx, margin: '6px 0 0' }}>{existingReview?.comment ?? comment}</p>
          )}
        </div>
      )}

      {/* Not yet unlocked and nothing to show */}
      {!assignmentCompleted && !hasOwn && !hasIncoming && (
        <div style={{ ...box, textAlign: 'center', padding: '22px 18px' }}>
          <div style={{ fontSize: 22, marginBottom: 6 }} aria-hidden>✦</div>
          <p style={{ ...mutedTx, margin: 0 }}>{t('Omdömen låses upp när samarbetet är markerat som slutfört.')}</p>
        </div>
      )}

      {/* All reviews received by the counterpart */}
      {hasIncoming && <ReviewList summary={allReviews!} />}
    </div>
  );
}

// ── Standalone review list (for profiles) ──────────────
interface ReviewListProps {
  summary: { averageStars: number; totalReviews: number; reviews: ReviewDto[] };
  compact?: boolean;
}

export function ReviewList({ summary, compact = false }: ReviewListProps) {
  return (
    <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: '"Fraunces",serif', fontWeight: 700, fontSize: 26, color: '#0B0F17', lineHeight: 1 }}>
          {summary.averageStars.toFixed(1)}
        </span>
        <StarRating value={Math.round(summary.averageStars)} readonly size="sm" />
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          {summary.totalReviews} {summary.totalReviews === 1 ? t('omdöme') : t('omdömen')}
        </span>
      </div>
      {!compact && summary.reviews.map((r) => (
        <div key={r.id} style={box}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <StarRating value={r.stars} readonly size="sm" />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0B0F17', minWidth: 0, overflowWrap: 'anywhere' }}>{r.reviewerName}</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 980, background: 'rgba(183,188,200,.2)', color: '#5c6270' }}>{roleLabel(r.reviewerRole)}</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{formatDate(r.createdAt)}</span>
          </div>
          {r.comment && <p style={{ ...mutedTx, margin: '8px 0 0' }}>{r.comment}</p>}
        </div>
      ))}
    </div>
  );
}
