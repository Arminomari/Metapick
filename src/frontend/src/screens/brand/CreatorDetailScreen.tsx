/** A creator as the brand sees them: one primary action, three secondary, everything else below. */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Clapperboard, Gift, MessageCircle } from 'lucide-react';
import api from '@/lib/api';
import { t } from '@/lib/i18n';
import { formatNumber, money } from '@/lib/utils';
import { CATEGORIES, canonicalCategory } from '@/lib/categories';
import { useCreatorPublicProfile, useCreatePrOffer } from '@/hooks/api';
import { useCommunityMembers } from '@/hooks/extra';
import { useToast } from '@/components/vyrle/Toast';
import { SourceNote } from '@/components/app/SourceNote';
import { ProfileHero } from '@/components/app/ProfileHero';
import { PortfolioGrid } from '@/components/app/PortfolioGrid';
import { DateInput } from '@/components/ui/DateInput';
import { Badge, BottomSheet, Button, Card, EmptyState, Field, Page, PageHead, Section, SkeletonList, StatRow, StatTile } from '@/components/ds';
import { MoreMenu, apiMessage } from '@/components/app/common';
import { ReviewList } from '@/components/app/Reviews';

export function MessageCreatorSheet({ creatorProfileId, creatorName, onClose }: { creatorProfileId: string; creatorName: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const text = body.trim(); if (!text) return; setBusy(true);
    try { await api.post(`/chat/d-${creatorProfileId}`, { body: text }); qc.invalidateQueries({ queryKey: ['chat-conversations'] }); qc.invalidateQueries({ queryKey: ['chat-unread'] }); toast.push(`${t('Meddelandet är skickat till')} ${creatorName}`, 'success'); onClose(); }
    catch (e) { toast.push(apiMessage(e, t('Kunde inte skicka meddelandet')), 'error'); }
    setBusy(false);
  };
  return (
    <BottomSheet open onClose={onClose} title={`${t('Skriv till')} ${creatorName}`} footer={<><Button variant="secondary" onClick={onClose}>{t('Avbryt')}</Button><Button onClick={() => void send()} loading={busy} disabled={!body.trim()}>{t('Skicka')}</Button></>}>
      <p className="ds-caption ds-muted">{t('Hamnar direkt i creatorns meddelanden — hen kan svara där.')}</p>
      <Field label={t('Meddelande')}><textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} autoFocus placeholder={t('Hej! Vi gillar ditt innehåll och skulle vilja samarbeta…')} /></Field>
    </BottomSheet>
  );
}

function PrOfferSheet({ creatorProfileId, defaultCategory, onClose }: { creatorProfileId: string; defaultCategory?: string | null; onClose: () => void }) {
  const create = useCreatePrOffer();
  const toast = useToast();
  const [form, setForm] = useState({ title: '', message: '', offerType: 'ProductGifting', category: canonicalCategory(defaultCategory) || 'Övrigt', compensationAmount: '', productDescription: '', productValue: '', deadline: '' });
  const [error, setError] = useState('');
  const needsCash = form.offerType === 'Paid' || form.offerType === 'Hybrid';
  const submit = async () => {
    setError('');
    if (!form.title.trim()) { setError(t('Rubrik krävs')); return; }
    if (!form.message.trim()) { setError(t('Meddelande krävs')); return; }
    if (needsCash && (!form.compensationAmount || Number(form.compensationAmount) <= 0)) { setError(t('Betalda erbjudanden kräver ett ersättningsbelopp')); return; }
    try {
      await create.mutateAsync({ creatorProfileId, title: form.title.trim(), message: form.message.trim(), offerType: form.offerType, category: form.category.trim(), compensationAmount: form.compensationAmount ? Number(form.compensationAmount) : null, currency: 'SEK', productDescription: form.productDescription.trim() || null, productValue: form.productValue ? Number(form.productValue) : null, deadline: form.deadline ? `${form.deadline}T00:00:00` : null, campaignId: null });
      toast.push(t('PR-erbjudandet är skickat. Du följer svaret under Meddelanden › Erbjudanden.'), 'success'); onClose();
    } catch (e) { setError(apiMessage(e, t('Kunde inte skicka erbjudandet'))); }
  };
  return (
    <BottomSheet open onClose={onClose} title={t('Skicka PR-erbjudande')} footer={<><Button variant="secondary" onClick={onClose}>{t('Avbryt')}</Button><Button onClick={() => void submit()} loading={create.isPending}>{t('Skicka erbjudande')}</Button></>}>
      <Field label={t('Rubrik')} error={error}><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t('t.ex. Prova vår nya meny')} /></Field>
      <Field label={t('Typ av erbjudande')}><select value={form.offerType} onChange={(e) => setForm({ ...form, offerType: e.target.value })}><option value="ProductGifting">{t('Produkt / gåva')}</option><option value="Paid">{t('Betald')}</option><option value="Hybrid">{t('Produkt + betalt')}</option><option value="Event">Event</option></select></Field>
      <Field label={t('Kategori')}><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{t(c)}</option>)}</select></Field>
      <Field label={t('Meddelande')}><textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder={t('Beskriv samarbetet, vad ni vill ha, och vad creatorn får.')} /></Field>
      <Field label={t('Vad får creatorn?')}><textarea rows={2} value={form.productDescription} onChange={(e) => setForm({ ...form, productDescription: e.target.value })} placeholder={t('t.ex. Måltid för två + dryck')} /></Field>
      <div className="ds-kv">
        <Field label={`${t('Ersättning (SEK)')}${needsCash ? ' *' : ''}`}><input inputMode="numeric" value={form.compensationAmount} onChange={(e) => setForm({ ...form, compensationAmount: e.target.value.replace(/\D/g, '') })} placeholder="0" /></Field>
        <Field label={t('Produktvärde (SEK)')}><input inputMode="numeric" value={form.productValue} onChange={(e) => setForm({ ...form, productValue: e.target.value.replace(/\D/g, '') })} placeholder="500" /></Field>
      </div>
      <Field label="Deadline"><DateInput value={form.deadline} onChange={(v) => setForm({ ...form, deadline: v })} className="ds-input" /></Field>
    </BottomSheet>
  );
}

export function BrandCreatorDetailScreen() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: c, isLoading } = useCreatorPublicProfile(id);
  const { data: members = [] } = useCommunityMembers();
  const [sheet, setSheet] = useState<null | 'msg' | 'pr'>(null);
  const [more, setMore] = useState(false);
  const membership = members.find((m) => m.creatorProfileId === id);
  const invite = useMutation({
    mutationFn: async () => (await api.post('/brand/community/invite', { creatorProfileId: id })).data.data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['brand-community'] }); toast.push(t('Inbjudan skickad — creatorn får en notis.'), 'success'); },
    onError: (e) => toast.push(apiMessage(e, t('Kunde inte bjuda in')), 'error'),
  });
  const remove = useMutation({
    mutationFn: async () => (await api.delete(`/brand/community/members/${id}`)).data.data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['brand-community'] }); toast.push(t('Borttagen ur communityn'), 'success'); },
    onError: (e) => toast.push(apiMessage(e, t('Kunde inte ta bort')), 'error'),
  });

  if (isLoading) return <Page><PageHead title="" back={{ onClick: () => navigate(-1) }} /><SkeletonList rows={3} /></Page>;
  if (!c) return <Page><PageHead title={t('Creator')} back={{ onClick: () => navigate(-1) }} /><Card><EmptyState title={t('Creatorn hittades inte')} description={t('Profilen kan ha tagits bort eller inte godkänts.')} /></Card></Page>;

  return (
    <Page>
      <PageHead title={c.displayName} back={{ onClick: () => navigate(-1) }} actions={<MoreMenu items={[
        { label: t('Öppna TikTok'), hidden: !c.tikTokUsername, onClick: () => window.open(`https://www.tiktok.com/@${c.tikTokUsername}`, '_blank', 'noopener') },
        { label: t('Öppna Instagram'), hidden: !c.instagramUsername, onClick: () => window.open(`https://www.instagram.com/${c.instagramUsername}`, '_blank', 'noopener') },
        { label: t('Öppna webbplats'), hidden: !c.website, onClick: () => window.open(c.website!, '_blank', 'noopener') },
        { label: t('Ta bort ur communityn'), danger: true, hidden: membership?.status !== 'Active', onClick: () => remove.mutate() },
      ]} />} />

      <ProfileHero coverUrl={c.coverUrl} avatarUrl={c.avatarUrl} name={c.displayName}
        meta={<>{c.category} · {c.country}{c.tikTokUsername ? ` · @${c.tikTokUsername}` : ''}</>}
        badges={<>
          {c.verifiedCreator && <Badge tone="ok">{t('Verifierad kreatör')}</Badge>}
          {c.topCreator && <Badge tone="accent">{t('Top creator')}</Badge>}
          <Badge tone="neutral">{c.level}</Badge>
          {c.openToPrOffers && <Badge tone="neutral">{t('Öppen för PR')}</Badge>}
        </>}>
        {c.bio && <p className="ds-body" style={{ marginTop: 12 }}>{c.bio}</p>}
        {c.profileTags.length > 0 && <div className="ds-tags" style={{ marginTop: 10 }}>{c.profileTags.map((tg) => <span key={tg} className="ds-tag">{tg}</span>)}</div>}
        <div style={{ marginTop: 14 }}>
          <StatRow cols={3}>
            <StatTile plain label={t('Verifierade views')} value={formatNumber(c.totalVerifiedViews)} />
            <StatTile plain label={t('Intäkt / 1K views')} value={c.totalVerifiedViews > 0 ? money(c.earningsPerThousandViews) : '–'} />
            <StatTile plain label={t('Godkänt')} value={c.totalVideos > 0 ? `${Math.round(c.approvalRate)} %` : '–'} hint={c.totalVideos > 0 ? `${c.approvedVideos}/${c.totalVideos} ${t('videor')}` : undefined} />
          </StatRow>
          <SourceNote source="tiktok" at={c.metricsUpdatedAt} scope={t('alla kampanjvideos')} />
          <div className="ds-facts" style={{ marginTop: 10 }}>
            <div className="ds-fact"><span>{t('Följare')} · TikTok</span><span className="ds-num">{c.tikTokVerified ? formatNumber(c.tikTokFollowerCount) : t('ej verifierat')}</span></div>
            <div className="ds-fact"><span>{t('Betyg')}</span><span className="ds-num">{c.reviewCount > 0 ? `${c.averageRating.toFixed(1)} · ${c.reviewCount} ${t('omdömen')}` : '–'}</span></div>
          </div>
        </div>
        <div className="ds-stack" style={{ marginTop: 14 }}>
          {membership?.status === 'Active' ? <Badge tone="ok">{t('I ditt community')}</Badge>
            : membership?.status === 'Invited' ? <Badge tone="warn">{t('Inbjuden — väntar på svar')}</Badge>
            : membership?.status === 'Requested' ? <Button to="/brand/creators?tab=community">{t('Vill gå med — svara under Community')}</Button>
            : <Button full onClick={() => invite.mutate()} loading={invite.isPending}>{t('Bjud in till community')}</Button>}
          <div className="ds-row ds-row--fill">
            <Button variant="secondary" icon={<MessageCircle />} onClick={() => setSheet('msg')}>{t('Meddelande')}</Button>
            <Button variant="secondary" icon={<Clapperboard />} onClick={() => navigate(`/brand/ugc/campaigns/new?creator=${c.id}`)}>{t('Beställ video')}</Button>
          </div>
          {c.openToPrOffers && <Button variant="secondary" full icon={<Gift />} onClick={() => setSheet('pr')}>{t('Skicka PR-erbjudande')}</Button>}
        </div>
      </ProfileHero>

      <Section title={c.totalVerifiedViews > 0 ? t('Verifierat på VYRLE') : t('Kampanjdata')} action={<Button variant="ghost" size="sm" onClick={() => setMore((v) => !v)}>{more ? t('Dölj') : t('Visa mer')}</Button>}>
        {more && (c.totalVerifiedViews > 0 ? (
          <Card>
            <StatRow cols={3}>
              <StatTile plain label={t('Views')} value={formatNumber(c.totalVerifiedViews ?? 0)} />
              <StatTile plain label={t('Gilla')} value={formatNumber(c.totalLikes ?? 0)} />
              <StatTile plain label={t('Engagemang')} value={`${(c.engagementRate ?? 0).toFixed(1)} %`} />
            </StatRow>
            <div className="ds-divider" />
            <StatRow cols={3}>
              <StatTile plain label={t('Kommentarer')} value={formatNumber(c.totalComments ?? 0)} />
              <StatTile plain label={t('Delningar')} value={formatNumber(c.totalShares ?? 0)} />
              <StatTile plain label={t('Samarbeten')} value={String(c.completedCampaigns)} />
            </StatRow>
            <div className="ds-facts" style={{ marginTop: 12 }}><div className="ds-fact"><span>{t('Intäkt / 1K views')}</span><span className="ds-num">{money(c.earningsPerThousandViews)}</span></div><div className="ds-fact"><span>{t('Godkännandegrad')}</span><span className="ds-num">{c.totalVideos > 0 ? `${Math.round(c.approvalRate)} % (${c.approvedVideos}/${c.totalVideos})` : '–'}</span></div><div className="ds-fact"><span>{t('Nivå')}</span><span>{c.level}</span></div></div>
            <p className="ds-caption ds-muted" style={{ marginTop: 8 }}>{t('Uppmätt av VYRLE på kampanjvideos — inte självrapporterat.')}</p>
            <SourceNote source="vyrle" at={c.metricsUpdatedAt} scope={`${c.verifiedPostCount} ${t('verifierade videor, alla kampanjer')}`} />
          </Card>
        ) : <Card><p className="ds-body ds-muted">{t('Inga verifierade kampanjvideos ännu — siffrorna dyker upp när creatorn kört sin första kampanj.')}</p></Card>)}
      </Section>

      <Section title={`${t('Portfölj')} (${c.portfolio.length})`}>
        {c.portfolio.length === 0 ? <Card><p className="ds-body ds-muted">{t('Creatorn har inte lagt till några arbeten ännu.')}</p></Card> : (
          <PortfolioGrid items={c.portfolio} />
        )}
      </Section>

      {c.reviewCount > 0 && <Section title={t('Omdömen')}><Card><ReviewList summary={{ averageStars: c.averageRating, totalReviews: c.reviewCount, reviews: c.recentReviews }} /></Card></Section>}

      {sheet === 'msg' && <MessageCreatorSheet creatorProfileId={c.id} creatorName={c.displayName} onClose={() => setSheet(null)} />}
      {sheet === 'pr' && <PrOfferSheet creatorProfileId={c.id} defaultCategory={c.category} onClose={() => setSheet(null)} />}
    </Page>
  );
}
