/** One queue for every video waiting on the brand: campaign submissions and tap submissions. */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';
import { t } from '@/lib/i18n';
import { formatDate, formatNumber } from '@/lib/utils';
import { useBrandCampaigns, useApproveSubmission, useRejectSubmission , useActionCounts } from '@/hooks/api';
import { useTapSubmissions } from '@/hooks/extra';
import { useToast } from '@/components/vyrle/Toast';
import { TikTokEmbed } from '@/components/ui/TikTokEmbed';
import type { ApiResponse, CampaignAnalytics } from '@/types';
import { Avatar, BottomSheet, Button, Card, Chip, Chips, EmptyState, Field, ListRow, Page, PageHead, SkeletonList } from '@/components/ds';
import { apiMessage } from '@/components/app/common';

interface Item { submissionId: string; assignmentId: string; creatorName: string; creatorAvatarUrl?: string | null; videoUrl: string; videoId?: string | null; views: number; submittedAt: string; hours: number; source: string; sourceId: string; kind: 'tap' | 'campaign'; campaignId?: string }

export function ReviewQueueScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [params] = useSearchParams();
  const only = params.get('campaign') ? { kind: 'campaign', id: params.get('campaign')! } : params.get('tap') ? { kind: 'tap', id: params.get('tap')! } : null;
  const { data: campaignsRes, isLoading: loadingCampaigns } = useBrandCampaigns('Active', 1);
  const { data: tapSubs = [], isLoading: loadingTaps } = useTapSubmissions();
  const { data: counts } = useActionCounts('brand');
  const campaigns = campaignsRes?.data ?? [];
  const analytics = useQueries({ queries: campaigns.map((c) => ({ queryKey: ['campaign-analytics', c.id], queryFn: async () => (await api.get<ApiResponse<CampaignAnalytics>>(`/campaigns/${c.id}/analytics`)).data.data })) });
  const approve = useApproveSubmission();
  const reject = useRejectSubmission();
  const [rejecting, setRejecting] = useState<Item | null>(null);
  const [reason, setReason] = useState('');
  const [filter, setFilter] = useState<'all' | 'campaign' | 'tap'>(only ? (only.kind as 'campaign' | 'tap') : 'all');

  const items: Item[] = [
    ...tapSubs.map((s) => ({ submissionId: s.submissionId, assignmentId: s.assignmentId, creatorName: s.creatorName, creatorAvatarUrl: s.creatorAvatarUrl, videoUrl: s.videoUrl, videoId: s.videoId, views: s.views, submittedAt: s.submittedAt, hours: s.hoursUntilAutoApprove, source: s.tapName ?? t('Kran'), sourceId: s.tapId ?? '', kind: 'tap' as const })),
    ...analytics.flatMap((q, i) => (q.data?.creatorPerformance ?? []).flatMap((cp) => cp.videos.filter((v) => v.submissionId && !['Approved', 'Rejected'].includes(v.status)).map((v) => ({ submissionId: v.submissionId!, assignmentId: cp.assignmentId, creatorName: cp.displayName, videoUrl: v.videoUrl, videoId: v.videoId, views: v.views, submittedAt: v.createdAt, hours: v.autoApproveAt ? Math.max(0, Math.ceil((+new Date(v.autoApproveAt) - Date.now()) / 3600000)) : 0, source: campaigns[i].name, sourceId: campaigns[i].id, kind: 'campaign' as const, campaignId: campaigns[i].id })))),
  ].filter((x) => !only || x.sourceId === only.id || (only.kind === 'tap' && x.kind === 'tap' && !x.sourceId)).filter((x) => filter === 'all' || x.kind === filter).sort((a, b) => a.hours - b.hours);
  const loading = loadingCampaigns || loadingTaps || analytics.some((q) => q.isLoading);
  const bust = () => ['tap-submissions', 'campaign-analytics', 'brand-taps', 'action-counts'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const decide = (it: Item, ok: boolean) => (ok ? approve.mutateAsync(it.submissionId) : reject.mutateAsync({ id: it.submissionId, reason: reason || undefined })).then(() => { bust(); toast.push(ok ? t('Videon godkänd — views räknas nu') : t('Videon nekad'), 'success'); setRejecting(null); setReason(''); }).catch((e) => toast.push(apiMessage(e, t('Kunde inte spara beslutet')), 'error'));

  return (
    <Page>
      <PageHead title={t('Att granska')} back={{ onClick: () => navigate(-1) }} />
      <p className="ds-caption ds-muted">{counts?.reviewWindowHours ? `${t('Videor som inte granskas inom')} ${counts.reviewWindowHours} ${t('timmar godkänns automatiskt.')}` : t('Videor som inte granskas i tid godkänns automatiskt.')}</p>
      {!only && <Chips><Chip selected={filter === 'all'} onClick={() => setFilter('all')}>{t('Alla')}</Chip><Chip selected={filter === 'tap'} onClick={() => setFilter('tap')}>{t('Kranar')}</Chip><Chip selected={filter === 'campaign'} onClick={() => setFilter('campaign')}>{t('Kampanjer')}</Chip></Chips>}
      {loading && items.length === 0 ? <SkeletonList rows={2} /> : items.length === 0 ? <Card><EmptyState icon={<CheckCircle2 />} title={t('Allt är granskat')} description={t('Nya videor från din community dyker upp här.')} /></Card> : items.map((it) => (
        <Card key={it.submissionId}>
          <ListRow className="ds-listrow--flush" leading={<Avatar name={it.creatorName} src={it.creatorAvatarUrl} />} title={it.creatorName} subtitle={`${it.source} · ${formatNumber(it.views)} views · ${formatDate(it.submittedAt)}`} wrapSubtitle chevron={false} trailing={<span className="ds-caption" style={{ color: 'var(--ds-warn)', fontWeight: 600 }}>{it.hours > 0 ? `${it.hours} ${t('tim')}` : t('snart')}</span>} />
          <div className="ds-embed" style={{ marginTop: 8 }}><TikTokEmbed videoUrl={it.videoUrl} videoId={it.videoId ?? undefined} compact /></div>
          <div className="ds-row" style={{ marginTop: 12 }}>
            <Button onClick={() => void decide(it, true)} loading={approve.isPending}>{t('Godkänn')}</Button>
            <Button variant="secondary" onClick={() => { setReason(''); setRejecting(it); }}>{t('Neka')}</Button>
            {it.kind === 'campaign' && it.campaignId && <Button variant="ghost" size="sm" onClick={() => navigate(`/brand/campaigns/${it.campaignId}/creators/${it.assignmentId}`)}>{t('Öppna')}</Button>}
          </div>
        </Card>
      ))}
      <BottomSheet open={!!rejecting} onClose={() => setRejecting(null)} title={`${t('Neka')} · ${rejecting?.creatorName ?? ''}`} footer={<><Button variant="secondary" onClick={() => setRejecting(null)}>{t('Avbryt')}</Button><Button danger loading={reject.isPending} onClick={() => rejecting && void decide(rejecting, false)}>{t('Neka')}</Button></>}>
        <Field label={t('Anledning (valfritt)')} hint={t('Creatorn ser den här texten.')}><textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </BottomSheet>
    </Page>
  );
}
