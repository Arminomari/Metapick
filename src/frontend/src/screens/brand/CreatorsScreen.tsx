/** Creators tab for brands: Community · Hitta · Ansökningar. */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, SlidersHorizontal, Users } from 'lucide-react';
import api from '@/lib/api';
import { t } from '@/lib/i18n';
import { money, formatDate, formatNumber, plural } from '@/lib/utils';
import { CATEGORIES } from '@/lib/categories';
import { ALL_TAGS } from '@/lib/tags';
import { useBrandCampaigns, useCampaignApplications, useApproveApplication, useRejectApplication, useCreatorSearch } from '@/hooks/api';
import { useCommunityMembers } from '@/hooks/extra';
import { useToast } from '@/components/vyrle/Toast';
import type { ApplicationItem } from '@/types';
import { Avatar, Badge, BottomSheet, Button, Card, Checkbox, Chip, Chips, EmptyState, Field, IconButton, List, ListRow, Page, PageHead, SegmentedControl, Section, SkeletonList, StatusBadge } from '@/components/ds';
import { MoreMenu, NotifBell, apiMessage } from '@/components/app/common';
import { SourceNote } from '@/components/app/SourceNote';
import { MessageCreatorSheet } from '@/screens/brand/CreatorDetailScreen';

type Tab = 'community' | 'find' | 'applications';

export function BrandCreatorsScreen() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'community';
  return (
    <Page>
      <PageHead title={t('Creators')} actions={<NotifBell />} />
      <SegmentedControl<Tab> segments={[{ key: 'community', label: t('Community') }, { key: 'find', label: t('Hitta') }, { key: 'applications', label: t('Ansökningar') }]} value={tab} onChange={(k) => setParams({ tab: k }, { replace: true })} />
      {tab === 'community' && <Community />}
      {tab === 'find' && <Find />}
      {tab === 'applications' && <Applications campaignId={params.get('campaign') ?? undefined} />}
    </Page>
  );
}

/* ── Community ────────────────────────────────────────────── */
function Community() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: members = [], isLoading } = useCommunityMembers();
  const [inviting, setInviting] = useState(false);
  const [messaging, setMessaging] = useState<{ id: string; name: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['brand-community'] }); qc.invalidateQueries({ queryKey: ['action-counts'] }); };
  const remove = useMutation({ mutationFn: async (id: string) => (await api.delete(`/brand/community/members/${id}`)).data.data, onSuccess: () => { invalidate(); toast.push(t('Borttagen ur communityn'), 'success'); }, onError: (e) => toast.push(apiMessage(e, t('Kunde inte ta bort')), 'error') });
  const respond = useMutation({ mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => (await api.post(`/brand/community/requests/${id}?approve=${approve}`)).data.data, onSuccess: (_d, v) => { invalidate(); toast.push(v.approve ? t('Creatorn är nu medlem') : t('Ansökan nekad'), 'success'); }, onError: (e) => toast.push(apiMessage(e, t('Något gick fel')), 'error') });

  const requests = members.filter((m) => m.status === 'Requested');
  const invited = members.filter((m) => m.status === 'Invited');
  const active = members.filter((m) => m.status === 'Active');
  if (isLoading) return <SkeletonList rows={4} />;

  return (
    <>
      <div className="ds-row" style={{ justifyContent: 'space-between' }}>
        <span className="ds-caption ds-muted">{plural(active.length, t('medlem'), t('medlemmar'))} · {t('medlemmar hämtar ur dina kranar')}</span>
        <Button variant="secondary" size="sm" onClick={() => setInviting(true)}>{t('Bjud in')}</Button>
      </div>
      {requests.length > 0 && (
        <Section title={t('Vill gå med')}>
          <List>
            {requests.map((m) => <ListRow key={m.creatorProfileId} leading={<Avatar name={m.displayName} src={m.avatarUrl} />} title={m.displayName} subtitle={`${formatNumber(m.tikTokFollowers)} ${t('följare')}${m.tikTokUsername ? ` · @${m.tikTokUsername}` : ''}`} wrapSubtitle chevron={false}
              trailing={<span className="ds-row"><Button size="sm" onClick={() => respond.mutate({ id: m.creatorProfileId, approve: true })} loading={respond.isPending}>{t('Godkänn')}</Button><MoreMenu items={[{ label: t('Visa profil'), to: `/brand/creators/${m.creatorProfileId}` }, { label: t('Neka'), danger: true, onClick: () => respond.mutate({ id: m.creatorProfileId, approve: false }) }]} /></span>} />)}
          </List>
        </Section>
      )}
      {invited.length > 0 && (
        <Section title={t('Inbjudna')}>
          <List>
            {invited.map((m) => <ListRow key={m.creatorProfileId} leading={<Avatar name={m.displayName} src={m.avatarUrl} />} title={m.displayName} badge={<Badge tone="warn">{t('Väntar på svar')}</Badge>} subtitle={`${t('Inbjuden')} ${formatDate(m.joinedAt)}`} chevron={false}
              trailing={<MoreMenu items={[{ label: t('Visa profil'), to: `/brand/creators/${m.creatorProfileId}` }, { label: t('Dra tillbaka inbjudan'), danger: true, onClick: () => remove.mutate(m.creatorProfileId) }]} />} />)}
          </List>
        </Section>
      )}
      <Section title={t('Medlemmar')}>
        {active.length === 0 ? (
          <Card><EmptyState icon={<Users />} title={t('Inga medlemmar ännu')} description={t('Kör en första kampanj så kvalificerar creators in automatiskt — eller bjud in direkt.')} action={<Button onClick={() => setInviting(true)}>{t('Bjud in creators')}</Button>} /></Card>
        ) : (
          <List>
            {active.map((m) => <ListRow key={m.creatorProfileId} leading={<Avatar name={m.displayName} src={m.avatarUrl} />} title={m.displayName} badge={m.source === 'AutoQualified' ? <Badge tone="ok">{t('Kvalificerad')}</Badge> : undefined}
              subtitle={`${formatNumber(m.tikTokFollowers)} ${t('följare')} · ${formatNumber(m.lifetimeViews)} views · ${money(m.lifetimeEarned)} ${t('utbetalt')}`} wrapSubtitle chevron={false}
              trailing={<MoreMenu items={[{ label: t('Visa profil'), to: `/brand/creators/${m.creatorProfileId}` }, { label: t('Skriv meddelande'), onClick: () => setMessaging({ id: m.creatorProfileId, name: m.displayName }) }, { label: confirmRemove === m.creatorProfileId ? t('Bekräfta: ta bort') : t('Ta bort ur communityn'), danger: true, onClick: () => { if (confirmRemove === m.creatorProfileId) { remove.mutate(m.creatorProfileId); setConfirmRemove(null); } else { setConfirmRemove(m.creatorProfileId); toast.push(t('Öppna menyn igen och bekräfta för att ta bort.'), 'info'); } } }]} />}
              onClick={() => navigate(`/brand/creators/${m.creatorProfileId}`)} />)}
          </List>
        )}
      </Section>
      <InviteSheet open={inviting} onClose={() => setInviting(false)} existing={members.map((m) => m.creatorProfileId)} />
      {messaging && <MessageCreatorSheet creatorProfileId={messaging.id} creatorName={messaging.name} onClose={() => setMessaging(null)} />}
    </>
  );
}

function InviteSheet({ open, onClose, existing }: { open: boolean; onClose: () => void; existing: string[] }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const { data, isLoading } = useCreatorSearch({ page: 1 });
  const already = new Set(existing);
  const all = (data?.data ?? []).filter((c) => !already.has(c.id));
  const shown = q.trim() ? all.filter((c) => `${c.displayName} ${c.category ?? ''} ${c.tikTokUsername ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())) : all;
  const invite = useMutation({
    mutationFn: async () => (await api.post('/brand/community/invite-many', { creatorProfileIds: picked })).data.data as number,
    onSuccess: (n) => { qc.invalidateQueries({ queryKey: ['brand-community'] }); toast.push(`${n} ${n === 1 ? t('creator inbjuden') : t('creators inbjudna')}`, 'success'); setPicked([]); onClose(); },
    onError: () => toast.push(t('Kunde inte bjuda in'), 'error'),
  });
  return (
    <BottomSheet open={open} onClose={onClose} title={t('Bjud in till din community')} footer={<><Button variant="secondary" onClick={onClose}>{t('Avbryt')}</Button><Button disabled={picked.length === 0} loading={invite.isPending} onClick={() => invite.mutate()}>{t('Bjud in')}{picked.length ? ` (${picked.length})` : ''}</Button></>}>
      <div className="ds-search"><Search /><input className="ds-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Sök på namn, nisch eller @handle…')} /></div>
      {isLoading ? <SkeletonList rows={3} /> : shown.length === 0 ? <p className="ds-body ds-muted">{t('Inga fler creators att bjuda in.')}</p> : (
        <List plain>
          {shown.map((c) => (
            <label key={c.id} className="ds-listrow" style={{ cursor: 'pointer', minHeight: 56 }}>
              <input type="checkbox" checked={picked.includes(c.id)} onChange={() => setPicked((p) => p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id])} style={{ width: 20, height: 20, accentColor: 'var(--ds-accent)' }} />
              <Avatar name={c.displayName} src={c.avatarUrl} size="sm" />
              <div className="ds-listrow-main"><div className="ds-listrow-title"><span>{c.displayName}</span></div><div className="ds-listrow-sub">{c.category}{c.tikTokUsername ? ` · @${c.tikTokUsername}` : ''} · {c.tikTokVerified ? `${formatNumber(c.tikTokFollowerCount)} ${t('följare')}` : t('TikTok ej verifierat')}</div></div>
            </label>
          ))}
        </List>
      )}
    </BottomSheet>
  );
}

/* ── Hitta ────────────────────────────────────────────────── */
const EMPTY_FILTERS = { category: '', country: '', minFollowers: '', minVerifiedViews: '', minApprovalRate: '', tag: '', openToPrOffers: false, onlyWithResults: false, sort: 'views' };
/** Ranking is by verified performance (server: CreatorRanking). Followers are not a ranking option here. */
const SORTS: [string, string][] = [['views', 'Verifierade views'], ['epm', 'Intäkt / 1K'], ['approval', 'Godkänt'], ['active', 'Senast aktiv']];

function Find() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [input, setInput] = useState('');
  const [f, setF] = useState(EMPTY_FILTERS);
  const [draft, setDraft] = useState(f);
  const [filters, setFilters] = useState(false);
  const [page, setPage] = useState(1);
  const { data, isLoading } = useCreatorSearch({ search: search || undefined, category: f.category || undefined, country: f.country || undefined, minFollowers: f.minFollowers ? Number(f.minFollowers) : undefined, minVerifiedViews: f.minVerifiedViews ? Number(f.minVerifiedViews) : undefined, minApprovalRate: f.minApprovalRate ? Number(f.minApprovalRate) : undefined, onlyWithResults: f.onlyWithResults || undefined, tag: f.tag || undefined, openToPrOffers: f.openToPrOffers || undefined, sort: f.sort, page });
  const activeFilters = [f.category, f.country, f.minFollowers, f.minVerifiedViews, f.minApprovalRate, f.tag, f.openToPrOffers ? 'pr' : '', f.onlyWithResults ? 'res' : ''].filter(Boolean).length;
  const latest = (data?.data ?? []).reduce<string | null>((m, c) => c.metricsUpdatedAt && (!m || c.metricsUpdatedAt > m) ? c.metricsUpdatedAt : m, null);
  const pages = data ? Math.ceil(data.totalCount / data.pageSize) : 1;
  return (
    <>
      <div className="ds-row">
        <div className="ds-search ds-grow"><Search /><input className="ds-input" type="search" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(input); setPage(1); } }} onBlur={() => { setSearch(input); setPage(1); }} placeholder={t('Namn, bio eller kategori')} aria-label={t('Sök')} /></div>
        <IconButton label={t('Filter')} boxed badge={activeFilters} onClick={() => { setDraft(f); setFilters(true); }}><SlidersHorizontal /></IconButton>
      </div>
      <Chips>
        {SORTS.map(([k, l]) => <Chip key={k} selected={f.sort === k} onClick={() => { setF({ ...f, sort: k }); setDraft({ ...draft, sort: k }); setPage(1); }}>{t(l)}</Chip>)}
      </Chips>
      {isLoading ? <SkeletonList rows={4} /> : !data || data.data.length === 0 ? <Card><EmptyState title={t('Inga creators matchade')} description={t('Justera filtren eller sök på något annat.')} /></Card> : (
        <>
          <span className="ds-caption ds-muted">{plural(data.totalCount, t('creator'), t('creators'))}</span>
          <List>
            {data.data.map((c) => {
              // Verified performance only: views, kr/1K and approval come from campaign videos the platform synced.
              const hasResults = c.totalVideos > 0 || c.totalVerifiedViews > 0;
              const perf = hasResults
                ? `${formatNumber(c.totalVerifiedViews)} ${t('verifierade views')} · ${money(c.earningsPerThousandViews)}/1K${c.totalVideos > 0 ? ` · ${Math.round(c.approvalRate)} % ${t('godkänt')}` : ''}`
                : t('Inga verifierade resultat än');
              const badge = c.topCreator ? <Badge tone="accent">{t('Top creator')}</Badge> : c.verifiedCreator ? <Badge tone="ok">{t('Verifierad kreatör')}</Badge> : c.openToPrOffers ? <Badge tone="neutral">{t('Öppen för PR')}</Badge> : undefined;
              return <ListRow key={c.id} leading={<Avatar name={c.displayName} src={c.avatarUrl} />} title={c.displayName} badge={badge} subtitle={`${perf} · ${c.category}${c.reviewCount > 0 ? ` · ★ ${c.averageRating.toFixed(1)}` : ''}`} wrapSubtitle onClick={() => navigate(`/brand/creators/${c.id}`)} />;
            })}
          </List>
          <SourceNote source="tiktok" at={latest} scope={t('kampanjvideos, alla i listan')} style={{ marginTop: 0 }} />
          {pages > 1 && <div className="ds-row" style={{ justifyContent: 'space-between' }}><Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('Föregående')}</Button><span className="ds-caption ds-muted">{page} / {pages}</span><Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t('Nästa')}</Button></div>}
        </>
      )}
      <BottomSheet open={filters} onClose={() => setFilters(false)} title={t('Filter')} footer={<><Button variant="secondary" onClick={() => { setDraft(EMPTY_FILTERS); }}>{t('Rensa')}</Button><Button onClick={() => { setF(draft); setPage(1); setFilters(false); }}>{t('Visa resultat')}</Button></>}>
        <Field label={t('Kategori')}><select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}><option value="">{t('Alla')}</option>{CATEGORIES.map((c) => <option key={c} value={c}>{t(c)}</option>)}</select></Field>
        <Field label={t('Land')}><select value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })}><option value="">{t('Alla')}</option><option value="SE">{t('Sverige')}</option><option value="NO">{t('Norge')}</option><option value="DK">{t('Danmark')}</option><option value="FI">{t('Finland')}</option></select></Field>
        <Field label={t('Minst antal följare')} hint={t('Räknar bara TikTok-konton kopplade via OAuth.')}><input inputMode="numeric" value={draft.minFollowers} onChange={(e) => setDraft({ ...draft, minFollowers: e.target.value.replace(/\D/g, '') })} placeholder="5000" /></Field>
        <Field label={t('Minst verifierade views')} hint={t('Views från verifierade kampanjvideos, inte från profilen.')}><input inputMode="numeric" value={draft.minVerifiedViews} onChange={(e) => setDraft({ ...draft, minVerifiedViews: e.target.value.replace(/\D/g, '') })} placeholder="10000" /></Field>
        <Field label={t('Minst godkännandegrad (%)')} hint={t('Andel godkända videor bland de som granskats. Creators utan granskade videor faller bort.')}><input inputMode="numeric" value={draft.minApprovalRate} onChange={(e) => setDraft({ ...draft, minApprovalRate: e.target.value.replace(/\D/g, '').slice(0, 3) })} placeholder="80" /></Field>
        <Checkbox label={t('Endast creators med verifierade resultat')} checked={draft.onlyWithResults} onChange={(e) => setDraft({ ...draft, onlyWithResults: e.target.checked })} />
        <Field label={t('Expertis')}><select value={draft.tag} onChange={(e) => setDraft({ ...draft, tag: e.target.value })}><option value="">{t('Alla taggar')}</option>{ALL_TAGS.map((tg) => <option key={tg} value={tg}>{tg}</option>)}</select></Field>
        <Field label={t('Sortera')}><select value={draft.sort} onChange={(e) => setDraft({ ...draft, sort: e.target.value })}><option value="views">{t('Flest verifierade views')}</option><option value="epm">{t('Bäst intäkt / 1K views')}</option><option value="approval">{t('Högst godkännandegrad')}</option><option value="active">{t('Senast aktiva')}</option><option value="rating">{t('Högst betyg')}</option><option value="recent">{t('Senast tillkomna')}</option></select></Field>
        <Checkbox label={t('Endast öppna för PR-erbjudanden')} checked={draft.openToPrOffers} onChange={(e) => setDraft({ ...draft, openToPrOffers: e.target.checked })} />
      </BottomSheet>
    </>
  );
}

/* ── Ansökningar ──────────────────────────────────────────── */
function Applications({ campaignId }: { campaignId?: string }) {
  const [params, setParams] = useSearchParams();
  const { data, isLoading } = useBrandCampaigns(undefined, 1);
  const [showHandled, setShowHandled] = useState(false);
  const campaigns = (data?.data ?? []).filter((c) => ['Active', 'Paused', 'Draft', 'PendingReview'].includes(c.status));
  const shown = campaignId ? campaigns.filter((c) => c.id === campaignId) : campaigns;
  if (isLoading) return <SkeletonList rows={3} />;
  if (campaigns.length === 0) return <Card><EmptyState title={t('Inga kampanjer')} description={t('Skapa en kampanj för att börja ta emot ansökningar.')} action={<Button to="/brand/campaigns/new">{t('Skapa kampanj')}</Button>} /></Card>;
  return (
    <>
      <Chips>
        <Chip selected={!campaignId} onClick={() => setParams({ tab: 'applications' }, { replace: true })}>{t('Alla')}</Chip>
        {campaigns.map((c) => <Chip key={c.id} selected={campaignId === c.id} onClick={() => setParams({ tab: 'applications', campaign: c.id }, { replace: true })}>{c.name}</Chip>)}
      </Chips>
      <div className="ds-row" style={{ justifyContent: 'flex-end' }}><Chip selected={showHandled} onClick={() => setShowHandled((v) => !v)}>{t('Visa hanterade')}</Chip></div>
      {shown.map((c) => <CampaignApplications key={c.id} campaignId={c.id} campaignName={c.name} showHandled={showHandled} />)}
      <span className="ds-caption ds-muted" style={{ display: params.get('x') ? 'none' : undefined }}>{t('Nekade creators får ett kort meddelande med din anledning.')}</span>
    </>
  );
}

function CampaignApplications({ campaignId, campaignName, showHandled }: { campaignId: string; campaignName: string; showHandled: boolean }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, isLoading } = useCampaignApplications(campaignId, undefined, 1);
  const approve = useApproveApplication();
  const reject = useRejectApplication();
  const [rejecting, setRejecting] = useState<ApplicationItem | null>(null);
  const [reason, setReason] = useState('');
  const rows = (data?.data ?? []).filter((a) => showHandled || a.status === 'Pending');
  if (isLoading) return <SkeletonList rows={2} />;
  if (rows.length === 0) return null;
  return (
    <Section title={campaignName}>
      <List>
        {rows.map((a) => (
          <ListRow key={a.id} leading={<Avatar name={a.creatorName} src={a.creatorAvatarUrl} />} title={a.creatorName} badge={a.status !== 'Pending' ? <StatusBadge status={a.status} /> : undefined}
            subtitle={<>{a.creatorCategory ? `${a.creatorCategory} · ` : ''}{(a.followerCount ?? 0) > 0 ? `${formatNumber(a.followerCount!)} ${t('följare')} · ` : ''}{formatDate(a.createdAt)}{a.message ? <><br />“{a.message}”</> : null}</>} wrapSubtitle chevron={false}
            trailing={a.status === 'Pending' ? <span className="ds-row"><Button size="sm" onClick={() => approve.mutateAsync({ id: a.id }).then(() => toast.push(t('Godkänd — creatorn får en notis.'), 'success')).catch((e) => toast.push(apiMessage(e, t('Kunde inte godkänna')), 'error'))} loading={approve.isPending}>{t('Godkänn')}</Button><MoreMenu items={[{ label: t('Visa profil'), to: `/brand/creators/${a.creatorProfileId}` }, { label: t('Neka'), danger: true, onClick: () => { setReason(''); setRejecting(a); } }]} /></span> : <IconButton label={t('Visa profil')} onClick={() => navigate(`/brand/creators/${a.creatorProfileId}`)}><Users /></IconButton>} />
        ))}
      </List>
      <BottomSheet open={!!rejecting} onClose={() => setRejecting(null)} title={`${t('Neka')} ${rejecting?.creatorName ?? ''}`} footer={<><Button variant="secondary" onClick={() => setRejecting(null)}>{t('Avbryt')}</Button><Button danger disabled={!reason.trim()} loading={reject.isPending} onClick={() => rejecting && reject.mutateAsync({ id: rejecting.id, reason: reason.trim() }).then(() => { setRejecting(null); toast.push(t('Ansökan nekad'), 'success'); }).catch((e) => toast.push(apiMessage(e, t('Kunde inte neka')), 'error'))}>{t('Neka')}</Button></>}>
        <Field label={t('Anledning')} hint={t('Creatorn ser den här texten.')}><textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
      </BottomSheet>
    </Section>
  );
}
