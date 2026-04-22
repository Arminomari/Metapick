import { useState } from 'react';
import { StarRating } from './StarRating';
import { Button } from './index';
import { useSubmitReview, useMyReviewForAssignment, useUserReviews } from '@/hooks/api';
import type { ReviewDto } from '@/types';
import { formatDate } from '@/lib/utils';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await submit.mutateAsync({ assignmentId, stars, comment: comment || undefined });
      setSubmitted(true);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? 'Kunde inte skicka omdömet');
    }
  };

  if (isLoading) return null;

  return (
    <div className="space-y-4">
      {/* Submit form — only when completed and no review yet */}
      {assignmentCompleted && !existingReview && !submitted && (
        <div className="border border-border rounded-lg p-4 bg-muted/20">
          <h3 className="font-semibold mb-3">Lämna ett omdöme</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Betyg</label>
              <StarRating value={stars} onChange={setStars} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Kommentar <span className="text-muted-foreground font-normal">(valfritt)</span></label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Berätta om din upplevelse..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <Button type="submit" size="sm" disabled={submit.isPending}>
              {submit.isPending ? 'Skickar...' : 'Skicka omdöme'}
            </Button>
          </form>
        </div>
      )}

      {/* Submitted confirmation */}
      {(existingReview || submitted) && (
        <div className="border border-border rounded-lg p-4 bg-muted/20">
          <h3 className="font-semibold mb-2">Ditt omdöme</h3>
          <StarRating value={existingReview?.stars ?? stars} readonly size="sm" />
          {(existingReview?.comment || comment) && (
            <p className="text-sm text-muted-foreground mt-1">{existingReview?.comment ?? comment}</p>
          )}
        </div>
      )}

      {/* All reviews received by the counterpart */}
      {allReviews && allReviews.totalReviews > 0 && (
        <ReviewList summary={allReviews} />
      )}
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
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <StarRating value={Math.round(summary.averageStars)} readonly size="sm" />
        <span className="font-semibold">{summary.averageStars.toFixed(1)}</span>
        <span className="text-sm text-muted-foreground">({summary.totalReviews} omdömen)</span>
      </div>
      {!compact && summary.reviews.map((r) => (
        <div key={r.id} className="border border-border rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <StarRating value={r.stars} readonly size="sm" />
              <span className="text-sm font-medium">{r.reviewerName}</span>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{r.reviewerRole}</span>
            </div>
            <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
          </div>
          {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
        </div>
      ))}
    </div>
  );
}
