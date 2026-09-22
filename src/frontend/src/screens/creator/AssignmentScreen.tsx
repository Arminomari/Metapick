/**
 * One assignment (campaign or tap) for a creator. Three numbers, one primary
 * action (add a video), sections below, tracking codes and extras in "…".
 */
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy } from 'lucide-react';
import api from '@/lib/api';
import { t } from '@/lib/i18n';
import { money, formatDate, formatNumber } from '@/lib/utils';
import { useAssignmentDetail, useCampaignDetail, useSubmitVideo } from '@/hooks/api';
import { useCreatorTaps, useMyTikTokVideos } from '@/hooks/extra';
import { useToast } from '@/components/vyrle/Toast';
import { TikTokEmbed } from '@/components/ui/TikTokEmbed';
import { Badge, BottomSheet, Button, Card, EmptyState, Field, IconButton, Meter, Page, PageHead, Section, SkeletonList, StatRow, StatTile, StatusBadge, StickyAction } from '@/components/ds';
import { MoreMenu, apiMessage, daysLeft } from '@/components/app/common';
import { ChatPanel } from '@/components/app/Chat';
import { ReviewSection } from '@/components/app/Reviews';
import { PayoutTerms, payoutHeadline } from '@/components/app/PayoutTerms';

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); } catch {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch { /* nothing more to do */ } document.body.removeChild(ta);
  }
}
function CopyRow({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  return (
    <div className="ds-row" style={{ justifyContent: 'space-between' }}>
      <div className="ds-grow"><div className="ds-caption ds-muted">{label}</div><div className="ds-body" style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{value}</div></div>
      <IconButton label={t('Kopiera')} boxed onClick={() => { void copyText(value); toast.push(t('Kopierat'), 'success'); }}><Copy /></IconButton>
    </div>
  );
}

function AddVideoSheet({ assignmentId, open, onClose }: { assignmentId: string; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const submit = useSubmitVideo();
  const { data: videos = [], isLoading, isError, error } = useMyTikTokVideos(open);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const attach = async (shareUrl: string, id: string) => {
    setBusy(id); setErr('');
    try { await api.post(`/assignments/${assignmentId}/submit`, { videoUrl: shareUrl }); await qc.invalidateQueries({ queryKey: ['assignment', assignmentId] }); await qc.invalidateQueries({ queryKey: ['my-tiktok-videos'] }); toast.push(t('Videon är kopplad till uppdraget!'), 'success'); onClose(); }
    catch (e) { toast.push(apiMessage(e, t('Kunde inte koppla videon')), 'error'); }
    setBusy(null);
  };
  const byLink = async () => {
    setErr('');
    try { await submit.mutateAsync({ assignmentId, videoUrl: url }); setUrl(''); toast.push(t('Videon är tillagd'), 'success'); onClose(); }
    catch (e) { setErr(apiMessage(e, t('Videon kunde inte läggas till — kontrollera länken och försök igen.'))); }
  };
  return (
    <BottomSheet open={open} onClose={onClose} title={t('Lägg till video')}>
      <p className="ds-caption ds-muted">{t('Välj videon från ditt TikTok-konto. Ingen hashtag eller kod behövs i beskrivningen.')}</p>
      {isLoading && <p className="ds-body ds-muted">{t('Hämtar dina videor från TikTok…')}</p>}
      {isError && <p className="ds-body" style={{ color: 'var(--ds-warn)' }}>{apiMessage(error, t('Kunde inte hämta dina videor just nu.'))}</p>}
      {!isLoading && !isError && videos.length === 0 && <p className="ds-body ds-muted">{t('Inga videor hittades på ditt TikTok-konto de senaste 90 dagarna.')}</p>}
      {videos.length > 0 && (
        <div className="ds-media-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          {videos.map((v) => (
            <button key={v.videoId} type="button" className="ds-media" style={{ border: 'none', padding: 0, opacity: v.alreadyTracked ? .5 : 1, cursor: v.alreadyTracked ? 'default' : 'pointer' }} disabled={v.alreadyTracked || busy === v.videoId} onClick={() => void attach(v.shareUrl, v.videoId)} aria-label={v.title || t('Utan text')}>
              {v.coverImageUrl ? <img src={v.coverImageUrl} alt="" /> : <span className="ds-caption">♪</span>}
              <span className="ds-media-tag">{v.alreadyTracked ? t('Används') : busy === v.videoId ? '…' : formatNumber(v.views)}</span>
            </button>
          ))}
        </div>
      )}
      <div className="ds-divider" />
      <Field label={t('Eller klistra in länken')} error={err}><input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.tiktok.com/@…/video/…" /></Field>
      <Button variant="secondary" full disabled={!url.trim()} loading={submit.isPending} onClick={() => void byLink()}>{t('Lägg till via länk')}</Button>
    </BottomSheet>
  );
}

export function AssignmentScreen() {
  const { id = '' } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: a, isLoading } = useAssignmentDetail(id);
  const { data: campaign } = useCampaignDetail(a?.campaignId ?? '');
  const { data: taps = [] } = useCreatorTaps();
  const [add, setAdd] = useState(params.get('add') === '1');
  const [codes, setCodes] = useState(false);
  useEffect(() => { if (params.get('add') === '1') { setAdd(true); const next = new URLSearchParams(params); next.delete('add'); setParams(next, { replace: true }); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [params.get('add')]);
  const refresh = useMutation({
    mutationFn: async () => { await api.post(`/assignments/${id}/refresh-views`); },
    onSuccess: () => { toast.push(t('Synk startad — klar inom någon minut'), 'success'); setTimeout(() => { qc.invalidateQueries({ queryKey: ['assignment'] }); qc.invalidateQueries({ queryKey: ['creator-assignments'] }); }, 45000); },
    onError: () => toast.push(t('Kunde inte starta synk'), 'error'),
  });

  if (isLoading || !a) return <Page><PageHead title="" back={{ to: '/creator/assignments' }} /><SkeletonList rows={3} /></Page>;
  const tap = taps.find((x) => x.assignmentId === a.id);
  const isTap = a.isTap === true;
  const left = !isTap ? daysLeft(campaign?.endDate) : null;
  const tapOpen = tap ? tap.tapStatus === 'Active' && tap.membershipStatus === 'Active' : false;
  const canAdd = a.status === 'Active' && (!isTap || tapOpen);

  return (
    <Page>
      <PageHead title={a.campaignName} back={{ to: '/creator/assignments' }} actions={<MoreMenu items={[
        { label: t('Spårningskoder'), hidden: !a.trackingTag, onClick: () => setCodes(true) },
        { label: t('Uppdatera views nu'), onClick: () => refresh.mutate() },
        { label: t('Visa företaget'), hidden: !tap, to: tap ? `/creator/brands/${tap.brandProfileId}` : undefined },
        { label: t('Lämna omdöme'), hidden: a.status !== 'Completed', onClick: () => document.getElementById('review')?.scrollIntoView({ block: 'start', behavior: 'smooth' }) },
      ]} />} />

      <div className="ds-row ds-row--wrap">
        {isTap ? <Badge tone={tapOpen ? 'ok' : 'neutral'}>{tapOpen ? t('Kran · öppen') : t('Kran · pausad')}</Badge> : <StatusBadge status={a.goalReached ? 'GoalReached' : a.status} />}
        {tap && <span className="ds-caption ds-muted">{tap.brandName}</span>}
      </div>

      <StatRow cols={3}>
        <StatTile label={t('Views')} count={isTap && tap ? tap.myMonthViews : a.totalVerifiedViews} format={formatNumber} hint={isTap ? t('denna månad') : undefined} />
        <StatTile label={t('Intjänat')} count={isTap && tap ? tap.myMonthEarned : a.currentPayoutAmount} format={money} hint={isTap ? t('denna månad') : undefined} />
        {isTap && tap ? <StatTile label={t('Kranen använd')} value={`${tap.tapMonthBudget > 0 ? Math.round((tap.tapMonthSpent / tap.tapMonthBudget) * 100) : 0} %`} hint={t('av månadsbudget')} />
          : <StatTile label={left != null ? t('Slutar om') : t('Slutdatum')} value={left != null ? `${left} ${t('dgr')}` : campaign?.endDate ? formatDate(campaign.endDate) : '–'} />}
      </StatRow>

      {a.goalReached && <Card><p className="ds-body" style={{ fontWeight: 600, color: 'var(--ds-ok)' }}>{t('Mål uppnått — maxersättningen är säkrad.')}</p><p className="ds-caption ds-muted">{t('Ersättningen kan begäras ut under Profil › Intäkter när kampanjen avslutas.')}</p></Card>}
      {tap && tap.monthlyCapPerCreator ? <Card><Meter value={tap.myMonthEarned} max={tap.monthlyCapPerCreator} left={t('Ditt månadstak')} right={`${money(tap.myMonthEarned)} / ${money(tap.monthlyCapPerCreator)}`} /></Card> : null}

      <Section title={t('Videor')}>
        {a.socialPosts?.length > 0 ? a.socialPosts.map((sp) => (
          <Card key={sp.id}>
            <div className="ds-row ds-row--wrap"><StatusBadge status={sp.status} /><span className="ds-caption ds-muted">{t('Hittad')} {formatDate(sp.discoveredAt)}</span></div>
            <p className="ds-body ds-num" style={{ marginTop: 8, fontWeight: 600 }}>{formatNumber(sp.views)} views <span className="ds-caption ds-muted" style={{ fontWeight: 500 }}>· {formatNumber(sp.likes)} {t('gilla')} · {formatNumber(sp.comments)} {t('kommentarer')} · {formatNumber(sp.shares)} {t('delningar')}</span></p>
            <div className="ds-embed" style={{ marginTop: 10 }}><TikTokEmbed videoUrl={sp.tikTokUrl} videoId={sp.tikTokVideoId} compact /></div>
          </Card>
        )) : a.submissions.length > 0 ? a.submissions.map((s) => (
          <Card key={s.id}>
            <div className="ds-row ds-row--wrap"><StatusBadge status={s.status} /><span className="ds-caption ds-muted">{formatDate(s.createdAt)}</span></div>
            <a className="ds-link ds-caption" href={s.tikTokVideoUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: 6, overflowWrap: 'anywhere' }}>{s.tikTokVideoUrl}</a>
            {s.status === 'Rejected' && s.rejectionReason && <p className="ds-caption" style={{ color: 'var(--ds-bad)', marginTop: 6 }}>{s.rejectionReason}</p>}
            <p className="ds-caption ds-muted" style={{ marginTop: 6 }}>{t('Väntar på att systemet ska hämta videodata…')}</p>
          </Card>
        )) : (
          <Card><EmptyState title={t('Inga videor ännu')} description={canAdd ? t('Lägg till en video så räknas dina views från och med nu.') : t('Videor du lägger till visas här.')} /></Card>
        )}
      </Section>

      <Section title={isTap ? t('Stående brief') : t('Brief & villkor')}>
        <Card>
          {tap ? (
            <>
              <p className="ds-caption ds-muted">{tap.cpm} kr / 1 000 views{tap.payoutCapPerVideo ? ` · ${t('max')} ${money(tap.payoutCapPerVideo)} / video` : ''}{tap.monthlyCapPerCreator ? ` · ${t('max')} ${money(tap.monthlyCapPerCreator)} / ${t('mån')}` : ''}{tap.briefUpdatedAt ? ` · ${t('uppdaterad')} ${formatDate(tap.briefUpdatedAt)}` : ''}</p>
              <p className="ds-prose" style={{ marginTop: 8 }}>{tap.brief}</p>
              {tap.contentInstructions && <p className="ds-prose ds-muted" style={{ marginTop: 8 }}>{tap.contentInstructions}</p>}
              <div style={{ marginTop: 12 }}><CopyRow label={t('Hashtag')} value={`#${tap.requiredHashtag}`} /></div>
            </>
          ) : campaign ? (
            <>
              <p className="ds-caption ds-muted">{payoutHeadline(campaign.payoutModel, campaign.payoutRules)} · {formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}</p>
              {campaign.contentInstructions && <p className="ds-prose" style={{ marginTop: 8 }}>{campaign.contentInstructions}</p>}
              {campaign.requirements?.length > 0 && <ul className="ds-body" style={{ margin: '8px 0 0', paddingLeft: 18 }}>{campaign.requirements.map((r, i) => <li key={i}>{r.value || r.requirementType}{r.isRequired ? ` (${t('krav')})` : ''}</li>)}</ul>}
              {campaign.perks && <p className="ds-body" style={{ marginTop: 8 }}><strong>{t('Förmåner')}:</strong> {campaign.perks}</p>}
              {(campaign.payoutRules?.length ?? 0) > 0 && <div style={{ marginTop: 12 }}><PayoutTerms rules={campaign.payoutRules} minViews={campaign.minViews} /></div>}
            </>
          ) : <SkeletonList rows={1} />}
        </Card>
      </Section>

      <Section title={t('Chatt')}><Card><ChatPanel assignmentId={a.id} /></Card></Section>
      <div id="review"><Section title={t('Omdöme')}><ReviewSection assignmentId={a.id} revieweeUserId={a.brandUserId} completed={a.status === 'Completed'} /></Section></div>

      {canAdd && <StickyAction><Button full onClick={() => setAdd(true)}>{t('Lägg till video')}</Button></StickyAction>}
      <AddVideoSheet assignmentId={a.id} open={add} onClose={() => setAdd(false)} />
      <BottomSheet open={codes} onClose={() => setCodes(false)} title={t('Spårningskoder')}>
        <p className="ds-caption ds-muted">{t('Frivilligt. Ta med hashtagen eller din tracking-tag i beskrivningen så hittas videon automatiskt — eller lägg till den manuellt.')}</p>
        {a.trackingTag?.recommendedHashtag && <CopyRow label={t('Kampanjens hashtag')} value={a.trackingTag.recommendedHashtag} />}
        {a.trackingTag && <CopyRow label={t('Din tracking-tag (utan #)')} value={a.trackingTag.tagCode} />}
        {a.trackingTag && <CopyRow label={t('Färdig beskrivning')} value={`${t('Min recension av produkten!')} ${a.trackingTag.recommendedHashtag ?? ''} ${a.trackingTag.tagCode}`.replace(/\s+/g, ' ').trim()} />}
      </BottomSheet>
    </Page>
  );
}
