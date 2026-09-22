/** A campaign for the brand, and one creator inside it. */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { t, statusLabel } from '@/lib/i18n';
import { money, formatDate, formatNumber, categoryLabel, payoutModelLabel } from '@/lib/utils';
import { useBrandProfile, useCampaignDetail, useCampaignAnalytics, useCampaignApplications, usePublishCampaign, useAssignmentDetail, useApproveSubmission, useRejectSubmission, useMarkManualPayoutSent } from '@/hooks/api';
import { useToast } from '@/components/vyrle/Toast';
import { TikTokEmbed } from '@/components/ui/TikTokEmbed';
import { DateInput } from '@/components/ui/DateInput';
import type { CreatorPerformance } from '@/types';
import { Avatar, Badge, BottomSheet, Button, Card, EmptyState, Field, List, ListRow, Page, PageHead, Section, SkeletonList, StatRow, StatTile, StatusBadge, StickyAction, statusTone } from '@/components/ds';
import { MoreMenu, apiMessage, daysLeft } from '@/components/app/common';
import { ChatPanel } from '@/components/app/Chat';
import { ReviewSection } from '@/components/app/Reviews';
import { PayoutTerms, payoutHeadline } from '@/components/app/PayoutTerms';

const PAYOUT_LABEL: Record<string, string> = { ReadyForManualPayment: 'Redo att betalas', AwaitingThreshold: 'Väntar på views', Completed: 'Pengar skickade', Approved: 'Godkänd för utbetalning', Pending: 'Väntar', Processing: 'Bearbetas' };

export function BrandCampaignDetailScreen() {
  const { id = '' } = useParams<{ id: string }>();
  const { data: brandProfile } = useBrandProfile();
  const orgVerified = !!brandProfile?.orgVerified;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: c, isLoading } = useCampaignDetail(id);
  const { data: analytics } = useCampaignAnalytics(id);
  const { data: apps } = useCampaignApplications(id);
  const publish = usePublishCampaign();
  const [edit, setEdit] = useState(false);
  const [facts, setFacts] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [brief, setBrief] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', budget: '', maxCreators: '', startDate: '', endDate: '' });
  const remove = useMutation({ mutationFn: async () => (await api.delete(`/campaigns/${id}`)).data.data, onSuccess: () => { qc.invalidateQueries({ queryKey: ['brand-campaigns'] }); toast.push(t('Kampanjen är borttagen'), 'success'); navigate('/brand/campaigns?tab=campaigns'); }, onError: (e) => toast.push(apiMessage(e, t('Kunde inte ta bort kampanjen')), 'error') });
  const saveDraft = useMutation({
    mutationFn: async () => api.put(`/campaigns/${id}`, { name: form.name.trim(), description: form.description.trim(), budget: Number(form.budget) || c?.budget, maxCreators: Number(form.maxCreators) || c?.maxCreators, startDate: form.startDate || null, endDate: form.endDate || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaign'] }); qc.invalidateQueries({ queryKey: ['brand-campaigns'] }); toast.push(t('Ändringarna är sparade'), 'success'); setEdit(false); },
    onError: (e) => toast.push(apiMessage(e, t('Kunde inte spara ändringarna.')), 'error'),
  });
  if (isLoading || !c) return <Page><PageHead title="" back={{ to: '/brand/campaigns?tab=campaigns' }} /><SkeletonList rows={3} /></Page>;
  const draftish = ['Draft', 'PendingReview'].includes(c.status);
  const pendingApps = (apps?.data ?? []).filter((a) => a.status === 'Pending').length;
  const creators = analytics?.creatorPerformance ?? [];
  const pendingVideos = creators.reduce((s, cp) => s + cp.videos.filter((v) => v.submissionId && !['Approved', 'Rejected'].includes(v.status)).length, 0);
  const left = daysLeft(c.endDate);
  const openEdit = () => { setForm({ name: c.name, description: c.description, budget: String(c.budget), maxCreators: String(c.maxCreators), startDate: c.startDate.slice(0, 10), endDate: c.endDate.slice(0, 10) }); setEdit(true); };

  return (
    <Page>
      <PageHead title={c.name} back={{ to: '/brand/campaigns?tab=campaigns' }} actions={<MoreMenu items={[
        { label: t('Redigera utkast'), hidden: c.status !== 'Draft', onClick: openEdit },
        { label: t('Snabbfakta'), onClick: () => setFacts(true) },
        { label: t('Ta bort kampanj'), danger: true, onClick: () => setConfirmDelete(true) },
      ]} />} />
      <div className="ds-row ds-row--wrap"><Badge tone={statusTone(c.status)}>{statusLabel(c.status)}</Badge><span className="ds-caption ds-muted">{categoryLabel(c.category)} · {formatDate(c.startDate)} – {formatDate(c.endDate)}{left != null ? ` · ${left} ${t('dgr kvar')}` : ''}</span></div>
      <StatRow cols={3}>
        <StatTile label={t('Views')} count={c.totalViews} format={formatNumber} />
        <StatTile label={draftish ? t('Maxkostnad') : t('Spenderat')} count={draftish ? c.budget : c.budgetSpent + c.budgetReserved} format={money} hint={draftish ? undefined : `${t('av')} ${money(c.budget)}`} />
        <StatTile label={t('Creators')} value={draftish ? String(c.maxCreators) : `${c.approvedCreatorCount} / ${c.maxCreators}`} />
      </StatRow>
      {c.status === 'PendingReview' && <Card><p className="ds-body" style={{ fontWeight: 600 }}>{t('Kampanjen väntar på granskning av VYRLE.')}</p><p className="ds-caption ds-muted">{t('Så fort den godkänns blir den synlig för creators och kan ta emot ansökningar.')}</p></Card>}
      {c.status === 'Draft' && <Card><EmptyState description={t('Kampanjen är ett utkast. Skicka in den för granskning så öppnas den för ansökningar när den godkänts.')} /></Card>}
      {c.status === 'Completed' && <Card><p className="ds-body" style={{ fontWeight: 600 }}>{t('Gör det här månatligt')}</p><p className="ds-caption ds-muted">{t('Creators som levererade är nu i ditt community. Öppna en kran så fortsätter de skapa löpande.')}</p></Card>}

      {!draftish && (
        <Section title={t('Creators')} action={pendingApps > 0 ? <Button variant="ghost" size="sm" to={`/brand/creators?tab=applications&campaign=${id}`}>{pendingApps} {t('ansökningar')}</Button> : undefined}>
          {creators.length === 0 ? <Card><EmptyState title={t('Inga aktiva creators')} description={pendingApps > 0 ? t('Godkänn ansökningar för att komma igång.') : t('Väntar på att creators ska ansöka.')} action={pendingApps > 0 ? <Button to={`/brand/creators?tab=applications&campaign=${id}`}>{t('Granska ansökningar')}</Button> : undefined} /></Card> : (
            <List>
              {creators.map((cp) => {
                const pend = cp.videos.filter((v) => v.submissionId && !['Approved', 'Rejected'].includes(v.status)).length;
                return <ListRow key={cp.creatorId} leading={<Avatar name={cp.displayName} />} title={cp.displayName} badge={pend > 0 ? <Badge tone="accent">{pend} {t('att granska')}</Badge> : cp.payoutStatus === 'ReadyForManualPayment' ? <Badge tone="warn">{t('Redo att betalas')}</Badge> : undefined} subtitle={`${formatNumber(cp.views)} views · ${cp.videos.filter((v) => v.status === 'Approved').length}/${c.requiredVideoCount ?? 1} ${t('videor godkända')} · ${t(PAYOUT_LABEL[cp.payoutStatus] ?? cp.payoutStatus)}`} wrapSubtitle value={money(cp.payoutAmount)} to={`/brand/campaigns/${id}/creators/${cp.assignmentId}`} />;
              })}
            </List>
          )}
        </Section>
      )}

      <Section title={t('Brief')} action={<Button variant="ghost" size="sm" onClick={() => setBrief((v) => !v)}>{brief ? t('Dölj') : t('Visa')}</Button>}>
        <Card>
          <p className="ds-caption ds-muted">{payoutModelLabel(c.payoutModel)} · {payoutHeadline(c.payoutModel, c.payoutRules)}{c.requiredHashtag ? ` · #${c.requiredHashtag.replace(/^#/, '')}` : ''}</p>
          {brief && (
            <div className="ds-stack" style={{ gap: 10, marginTop: 10 }}>
              <p className="ds-prose">{c.description}</p>
              {c.contentInstructions && <p className="ds-prose"><strong>{t('Instruktioner')}:</strong> {c.contentInstructions}</p>}
              {c.perks && <p className="ds-prose"><strong>{t('Förmåner')}:</strong> {c.perks}</p>}
              {c.contentTags?.length > 0 && <div className="ds-tags">{c.contentTags.map((tg) => <span key={tg} className="ds-tag">{tg}</span>)}</div>}
              {(c.payoutRules?.length ?? 0) > 0 && <PayoutTerms rules={c.payoutRules} minViews={c.minViews} />}
            </div>
          )}
        </Card>
      </Section>

      {c.status === 'Draft' && (orgVerified
        ? <StickyAction><Button full loading={publish.isPending} onClick={() => publish.mutateAsync(id).then(() => toast.push(t('Skickad för granskning'), 'success')).catch((e) => toast.push(apiMessage(e, t('Kunde inte skicka')), 'error'))}>{t('Skicka för granskning')}</Button></StickyAction>
        : <Card><p className="ds-body" style={{ fontWeight: 600 }}>{t('Kampanjen kan inte skickas in än')}</p><p className="ds-caption ds-muted">{t('Organisationsnumret måste vara verifierat innan en kampanj går live. Det tar en minut på företagsprofilen.')}</p><div style={{ marginTop: 8 }}><Button variant="secondary" size="sm" to="/brand/profile/edit">{t('Verifiera organisationsnumret')}</Button></div></Card>)}
      {c.status === 'Completed' && <StickyAction><Button full to="/brand/tap/new">{t('Öppna kranen')}</Button></StickyAction>}
      {!draftish && c.status !== 'Completed' && pendingVideos > 0 && <StickyAction><Button full to={`/brand/review?campaign=${id}`}>{t('Granska videor')} ({pendingVideos})</Button></StickyAction>}

      <BottomSheet open={facts} onClose={() => setFacts(false)} title={t('Snabbfakta')}>
        <div className="ds-facts">
          <div className="ds-fact"><span>Status</span><span>{statusLabel(c.status)}</span></div>
          <div className="ds-fact"><span>{t('Kategori')}</span><span>{categoryLabel(c.category)}</span></div>
          <div className="ds-fact"><span>{t('Period')}</span><span>{formatDate(c.startDate)} – {formatDate(c.endDate)}</span></div>
          <div className="ds-fact"><span>{t('Creators')}</span><span className="ds-num">{c.approvedCreatorCount} / {c.maxCreators}</span></div>
          <div className="ds-fact"><span>{t('Budget')}</span><span className="ds-num">{money(c.budgetSpent)} {t('av')} {money(c.budget)}</span></div>
          <div className="ds-fact"><span>{t('Reserverat')}</span><span className="ds-num">{money(c.budgetReserved)}</span></div>
          <div className="ds-fact"><span>{t('Videor per creator')}</span><span className="ds-num">{c.requiredVideoCount}</span></div>
          {c.publishedAt && <div className="ds-fact"><span>{t('Publicerad')}</span><span>{formatDate(c.publishedAt)}</span></div>}
        </div>
      </BottomSheet>
      <BottomSheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title={t('Ta bort kampanjen?')} footer={<><Button variant="secondary" onClick={() => setConfirmDelete(false)}>{t('Avbryt')}</Button><Button danger loading={remove.isPending} onClick={() => remove.mutate()}>{t('Ta bort')}</Button></>}><p className="ds-body">{t('Det går inte att ångra.')}</p></BottomSheet>
      <BottomSheet open={edit} onClose={() => setEdit(false)} title={t('Redigera utkast')} footer={<><Button variant="secondary" onClick={() => setEdit(false)}>{t('Avbryt')}</Button><Button loading={saveDraft.isPending} onClick={() => saveDraft.mutate()}>{t('Spara')}</Button></>}>
        <Field label={t('Kampanjnamn')}><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label={t('Beskrivning')}><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <div className="ds-kv"><Field label={t('Maximal kostnad (kr)')}><input type="number" min={1} value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></Field><Field label={t('Max antal creators')}><input type="number" min={1} value={form.maxCreators} onChange={(e) => setForm({ ...form, maxCreators: e.target.value })} /></Field></div>
        <div className="ds-kv"><Field label={t('Startdatum')}><DateInput value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} /></Field><Field label={t('Slutdatum')}><DateInput value={form.endDate} onChange={(v) => setForm({ ...form, endDate: v })} /></Field></div>
      </BottomSheet>
    </Page>
  );
}

/** One creator inside a campaign: their videos, chat, payout and review. Replaces the unreachable brand assignment page. */
export function CampaignCreatorScreen() {
  const { id = '', assignmentId = '' } = useParams<{ id: string; assignmentId: string }>();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: a, isLoading } = useAssignmentDetail(assignmentId);
  const { data: c } = useCampaignDetail(id);
  const { data: analytics } = useCampaignAnalytics(id);
  const approve = useApproveSubmission();
  const reject = useRejectSubmission();
  const markPaid = useMarkManualPayoutSent();
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const refresh = useMutation({ mutationFn: async () => { await api.post(`/assignments/${assignmentId}/refresh-views`); }, onSuccess: () => { toast.push(t('Synk startad — klar inom någon minut'), 'success'); setTimeout(() => qc.invalidateQueries({ queryKey: ['campaign-analytics'] }), 45000); } });
  if (isLoading || !a) return <Page><PageHead title="" back={{ to: `/brand/campaigns/${id}` }} /><SkeletonList rows={3} /></Page>;
  const cp: CreatorPerformance | undefined = analytics?.creatorPerformance.find((x) => x.assignmentId === assignmentId);
  const videos = cp?.videos ?? [];
  const pending = videos.filter((v) => v.submissionId && !['Approved', 'Rejected'].includes(v.status));
  const approvedCount = videos.filter((v) => v.status === 'Approved').length;
  const canMarkPaid = !!cp && cp.payoutAmount > 0 && approvedCount > 0 && !['Completed', 'Processing', 'Approved'].includes(cp.payoutStatus);
  const decide = (submissionId: string, ok: boolean) => (ok ? approve.mutateAsync(submissionId) : reject.mutateAsync({ id: submissionId, reason: reason || undefined })).then(() => { toast.push(ok ? t('Videon godkänd — views räknas nu') : t('Videon nekad'), 'success'); setRejecting(null); setReason(''); }).catch((e) => toast.push(apiMessage(e, t('Kunde inte spara beslutet')), 'error'));

  return (
    <Page>
      <PageHead title={a.creatorName || t('Creator')} back={{ to: `/brand/campaigns/${id}` }} actions={<MoreMenu items={[{ label: t('Uppdatera views nu'), onClick: () => refresh.mutate() }, { label: t('Visa profil'), to: `/brand/creators/${a.creatorProfileId}` }, { label: t('Betygsätt'), hidden: a.status !== 'Completed', onClick: () => document.getElementById('review')?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }]} />} />
      <div className="ds-row ds-row--wrap"><StatusBadge status={a.status} /><span className="ds-caption ds-muted">{a.campaignName}</span></div>
      <StatRow cols={3}>
        <StatTile label={t('Views')} count={a.totalVerifiedViews} format={formatNumber} />
        <StatTile label={t('Intjänat')} count={a.currentPayoutAmount} format={money} hint={cp ? t(PAYOUT_LABEL[cp.payoutStatus] ?? cp.payoutStatus) : undefined} />
        <StatTile label={t('Videor godkända')} value={`${approvedCount} / ${c?.requiredVideoCount ?? 1}`} />
      </StatRow>
      {cp?.payoutStatus === 'AwaitingThreshold' && <p className="ds-caption ds-muted">{approvedCount > 0 ? t('Creatorn har godkända videor men har inte nått betalningsnivån ännu.') : t('Väntar på att creatorn lägger till en video — godkänn den sedan här.')}</p>}

      <Section title={t('Videor')}>
        {videos.length === 0 ? <Card><EmptyState title={t('Inga videor ännu')} /></Card> : videos.map((v, i) => {
          const pend = v.submissionId && !['Approved', 'Rejected'].includes(v.status);
          const hours = v.autoApproveAt ? Math.max(0, Math.ceil((+new Date(v.autoApproveAt) - Date.now()) / 3600000)) : 0;
          return (
            <Card key={i}>
              <div className="ds-row ds-row--wrap"><StatusBadge status={v.status} /><span className="ds-caption ds-muted">{formatNumber(v.views)} views · {formatDate(v.createdAt)}</span>{pend && <span className="ds-caption" style={{ color: 'var(--ds-warn)', fontWeight: 600 }}>{hours > 0 ? `${t('auto-godkänns om')} ${hours} ${t('tim')}` : t('auto-godkänns inom kort')}</span>}</div>
              <div className="ds-embed" style={{ marginTop: 10 }}><TikTokEmbed videoUrl={v.videoUrl} videoId={v.videoId ?? undefined} compact /></div>
              {v.rejectionReason && <p className="ds-caption" style={{ color: 'var(--ds-bad)', marginTop: 8 }}>{t('Anledning')}: {v.rejectionReason}</p>}
              {pend && <div className="ds-row" style={{ marginTop: 10 }}><Button size="sm" onClick={() => void decide(v.submissionId!, true)} loading={approve.isPending}>{t('Godkänn')}</Button><Button size="sm" variant="secondary" onClick={() => { setReason(''); setRejecting(v.submissionId!); }}>{t('Neka')}</Button></div>}
            </Card>
          );
        })}
      </Section>
      <Section title={t('Chatt')}><Card><ChatPanel assignmentId={assignmentId} /></Card></Section>
      <div id="review"><Section title={t('Omdöme')}><ReviewSection assignmentId={assignmentId} revieweeUserId={a.creatorUserId} completed={a.status === 'Completed'} /></Section></div>

      {pending.length > 0 ? <StickyAction><Button full loading={approve.isPending} onClick={() => void decide(pending[0].submissionId!, true)}>{t('Godkänn video')} ({pending.length})</Button></StickyAction>
        : canMarkPaid ? <StickyAction><Button full loading={markPaid.isPending} onClick={() => markPaid.mutateAsync(assignmentId).then(() => toast.push(t('Markerad som betald'), 'success')).catch((e) => toast.push(apiMessage(e, t('Kunde inte markera')), 'error'))}>{t('Markera som betald')} · {money(cp!.payoutAmount)}</Button></StickyAction> : null}
      <BottomSheet open={!!rejecting} onClose={() => setRejecting(null)} title={t('Neka videon')} footer={<><Button variant="secondary" onClick={() => setRejecting(null)}>{t('Avbryt')}</Button><Button danger loading={reject.isPending} onClick={() => rejecting && void decide(rejecting, false)}>{t('Neka')}</Button></>}>
        <Field label={t('Anledning (valfritt)')}><textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </BottomSheet>
    </Page>
  );
}
