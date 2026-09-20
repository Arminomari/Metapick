/**
 * Kampanjer tab for creators. Two segments:
 *   Mina    — everything I am in, grouped by what it is and what it needs.
 *   Upptäck — everything I can earn from, one list with type chips.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Briefcase, Search } from 'lucide-react';
import api from '@/lib/api';
import { t } from '@/lib/i18n';
import { money, formatNumber, formatDate, categoryLabel, payoutSummaryText, plural } from '@/lib/utils';
import { useBrowseCampaigns, useCreatorAssignments, useMyApplications, useSavedCampaignIds, useToggleSaveCampaign } from '@/hooks/api';
import { useUgcCollabs, useUgcMyApplications, useUgcCreatorCampaigns, useWithdrawUgcApplication, collabStatusLabel, formatOre, apiError } from '@/hooks/ugc';
import { useCreatorTaps, useMyCommunities, usePendingCommunityRequests } from '@/hooks/extra';
import { useToast } from '@/components/vyrle/Toast';
import { Avatar, Badge, Button, Card, Chip, Chips, EmptyState, IconButton, List, ListRow, Page, PageHead, SegmentedControl, Section, SkeletonList, StatusBadge, statusTone } from '@/components/ds';
import { NotifBell, apiMessage } from '@/components/app/common';
import { MoreMenu } from '@/components/app/common';

type Seg = 'mine' | 'discover';

export function CreatorWorkScreen({ segment }: { segment: Seg }) {
  const navigate = useNavigate();
  return (
    <Page>
      <PageHead title={t('Kampanjer')} actions={<NotifBell />} />
      <SegmentedControl<Seg> segments={[{ key: 'mine', label: t('Mina') }, { key: 'discover', label: t('Upptäck') }]} value={segment} onChange={(k) => navigate(k === 'mine' ? '/creator/assignments' : '/creator/browse')} />
      {segment === 'mine' ? <Mine /> : <Discover />}
    </Page>
  );
}

/* ── Mina ─────────────────────────────────────────────────── */
function Mine() {
  const toast = useToast();
  const qc = useQueryClient();
  const { data: asg, isLoading } = useCreatorAssignments(undefined, 1, 100);
  const { data: collabs = [] } = useUgcCollabs('creator');
  const { data: apps } = useMyApplications();
  const { data: ugcApps = [] } = useUgcMyApplications();
  const { data: taps = [] } = useCreatorTaps();
  const { data: requests = [] } = usePendingCommunityRequests();
  const withdrawBid = useWithdrawUgcApplication();
  const withdrawRequest = useMutation({
    mutationFn: async (brandProfileId: string) => (await api.delete(`/creator/communities/${brandProfileId}`)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-communities'] }); toast.push(t('Ansökan är återtagen'), 'success'); },
    onError: (e) => toast.push(apiMessage(e, t('Kunde inte ta tillbaka ansökan')), 'error'),
  });
  const [showDone, setShowDone] = useState(false);
  useEffect(() => { const id = window.location.hash.slice(1); if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50); }, []);

  const all = asg?.data ?? [];
  const tapById = new Map(taps.map((x) => [x.assignmentId, x]));
  const tapRows = all.filter((a) => a.isTap && a.status === 'Active');
  const activeRows = all.filter((a) => !a.isTap && a.status === 'Active');
  const doneRows = all.filter((a) => a.status !== 'Active');
  const needsMe = collabs.filter((c) => c.needsMyAction);
  const running = collabs.filter((c) => !c.needsMyAction && !['Paid', 'Cancelled'].includes(c.status));
  const doneCollabs = collabs.filter((c) => ['Paid', 'Cancelled'].includes(c.status));
  const pendingApps = (apps?.data ?? []).filter((a) => a.status === 'Pending');
  const pendingBids = ugcApps.filter((a) => a.status === 'Applied' || a.status === 'Preselected');
  const empty = all.length + collabs.length + pendingApps.length + pendingBids.length + requests.length === 0;

  if (isLoading) return <SkeletonList rows={4} />;
  if (empty) return <Card><EmptyState icon={<Briefcase />} title={t('Inga uppdrag än')} description={t('Ansök till kampanjer så dyker ditt första uppdrag upp här.')} action={<Button to="/creator/browse">{t('Upptäck kampanjer')}</Button>} /></Card>;

  const asgRow = (a: typeof all[number]) => {
    const tap = tapById.get(a.id);
    return <ListRow key={a.id} leading={<Avatar name={a.campaignName} rounded />} title={a.campaignName}
      badge={a.isTap ? <Badge tone={tap && tap.tapStatus === 'Active' ? 'ok' : 'neutral'}>{tap && tap.tapStatus === 'Active' ? t('Kran · öppen') : t('Kran')}</Badge> : a.goalReached ? <Badge tone="ok">{t('Mål uppnått')}</Badge> : a.status !== 'Active' ? <StatusBadge status={a.status} /> : undefined}
      subtitle={tap ? `${tap.cpm} kr / 1 000 views · ${formatNumber(tap.myMonthViews)} views ${t('denna månad')}` : `${formatNumber(a.totalVerifiedViews)} views · ${t('tilldelad')} ${formatDate(a.assignedAt)}`}
      value={money(tap ? tap.myMonthEarned : a.currentPayoutAmount)} to={`/creator/assignments/${a.id}`} />;
  };
  const collabRow = (c: typeof collabs[number]) => (
    <ListRow key={c.id} leading={<Avatar name={c.brandName} src={c.brandLogoUrl} rounded />} title={c.title}
      badge={c.needsMyAction ? <Badge tone="accent">{t('Din tur')}</Badge> : <Badge tone={statusTone(c.status)}>{collabStatusLabel(c.status)}</Badge>}
      subtitle={`${c.brandName} · ${c.compensation === 'ProductExchange' ? t('Produktbyte') : formatOre(c.agreedAmountOre)}${c.deadlineAt && !['Paid', 'Cancelled', 'Submitted', 'Approved'].includes(c.status) ? ` · ${t('senast')} ${formatDate(c.deadlineAt)}` : ''}`}
      to={`/creator/ugc/collabs/${c.id}`} />
  );

  return (
    <>
      {needsMe.length > 0 && <Section title={t('Behöver dig')}><List>{needsMe.map(collabRow)}</List></Section>}
      {tapRows.length > 0 && <div id="kranar"><Section title={t('Kranar')}><List>{tapRows.map(asgRow)}</List></Section></div>}
      {activeRows.length > 0 && <Section title={t('Kampanjer')}><List>{activeRows.map(asgRow)}</List></Section>}
      {running.length > 0 && <div id="video"><Section title={t('Videouppdrag')}><List>{running.map(collabRow)}</List></Section></div>}
      {(pendingApps.length + pendingBids.length + requests.length) > 0 && (
        <div id="ansokta"><Section title={t('Ansökta')}>
          <List>
            {pendingApps.map((a) => <ListRow key={a.id} leading={<Avatar name={a.campaignName} rounded />} title={a.campaignName} badge={<Badge tone="warn">{t('Väntar på svar')}</Badge>} subtitle={`${t('Kampanj')} · ${formatDate(a.createdAt)}`} to={`/creator/campaigns/${a.campaignId}`} />)}
            {pendingBids.map((a) => <ListRow key={a.id} leading={<Avatar name={a.campaignTitle} rounded />} title={a.campaignTitle} badge={<Badge tone={a.status === 'Preselected' ? 'accent' : 'warn'}>{a.status === 'Preselected' ? t('Favorit hos företaget') : t('Väntar på svar')}</Badge>} subtitle={`${t('Videouppdrag')}${a.bidOre > 0 ? ` · ${formatOre(a.bidOre)} / video` : ''} · ${formatDate(a.createdAt)}`} chevron={false}
              trailing={<MoreMenu items={[{ label: t('Ta tillbaka'), danger: true, onClick: () => withdrawBid.mutate(a.id, { onSuccess: () => toast.push(t('Ansökan är återtagen'), 'success'), onError: (e) => toast.push(apiError(e, t('Kunde inte återta')), 'error') }) }]} />} />)}
            {requests.map((r) => <ListRow key={r.brandProfileId} leading={<Avatar name={r.brandName} src={r.brandLogoUrl} rounded />} title={r.brandName} badge={<Badge tone="warn">{t('Väntar på svar')}</Badge>} subtitle={`${t('Community')} · ${formatDate(r.joinedAt)}`} chevron={false}
              trailing={<MoreMenu items={[{ label: t('Visa företag'), to: `/creator/brands/${r.brandProfileId}` }, { label: t('Ta tillbaka'), danger: true, onClick: () => withdrawRequest.mutate(r.brandProfileId) }]} />} />)}
          </List>
        </Section></div>
      )}
      {(doneRows.length + doneCollabs.length) > 0 && (
        <Section title={t('Avslutade')} action={<Button variant="ghost" size="sm" onClick={() => setShowDone((v) => !v)}>{showDone ? t('Dölj') : `${t('Visa')} (${doneRows.length + doneCollabs.length})`}</Button>}>
          {showDone && <List>{doneRows.map(asgRow)}{doneCollabs.map(collabRow)}</List>}
        </Section>
      )}
    </>
  );
}

/* ── Upptäck ──────────────────────────────────────────────── */
type Kind = 'all' | 'campaigns' | 'taps' | 'video';
function Discover() {
  const [params, setParams] = useSearchParams();
  const kind = (params.get('type') as Kind) || 'all';
  const q = params.get('q') ?? '';
  const [query, setQuery] = useState(q);
  const [page, setPage] = useState(1);
  const setKind = (k: Kind) => { const next = new URLSearchParams(params); if (k === 'all') next.delete('type'); else next.set('type', k); setParams(next, { replace: true }); setPage(1); };
  const commit = (v: string) => { setQuery(v); const next = new URLSearchParams(params); if (v.trim()) next.set('q', v.trim()); else next.delete('q'); setParams(next, { replace: true }); };
  const term = query.trim().toLowerCase();
  const chips: [Kind, string][] = [['all', t('Alla')], ['campaigns', t('Kampanjer')], ['taps', t('Kranar')], ['video', t('Videouppdrag')]];
  return (
    <>
      <div className="ds-search"><Search /><input className="ds-input" type="search" value={query} onChange={(e) => commit(e.target.value)} placeholder={t('Sök kampanjer, varumärken…')} aria-label={t('Sök')} /></div>
      <Chips>{chips.map(([k, l]) => <Chip key={k} selected={kind === k} onClick={() => setKind(k)}>{l}</Chip>)}</Chips>
      {(kind === 'all' || kind === 'campaigns') && <CampaignList term={term} page={page} setPage={setPage} compact={kind === 'all'} />}
      {(kind === 'all' || kind === 'taps') && <TapList term={term} compact={kind === 'all'} />}
      {(kind === 'all' || kind === 'video') && <VideoJobList term={term} compact={kind === 'all'} />}
    </>
  );
}

function CampaignList({ term, page, setPage, compact }: { term: string; page: number; setPage: (n: number) => void; compact: boolean }) {
  const { data, isLoading } = useBrowseCampaigns(undefined, undefined, page);
  const { data: apps } = useMyApplications();
  const { data: savedIds } = useSavedCampaignIds();
  const toggleSave = useToggleSaveCampaign();
  const toast = useToast();
  const status = new Map((apps?.data ?? []).map((a) => [a.campaignId, a.status]));
  const saved = new Set(savedIds ?? []);
  const rows = (data?.data ?? []).filter((c) => !term || `${c.name} ${c.brandName ?? ''} ${c.category ?? ''}`.toLowerCase().includes(term));
  const shown = compact ? rows.slice(0, 5) : rows;
  const pages = data ? Math.ceil(data.totalCount / data.pageSize) : 1;
  return (
    <Section title={compact ? t('Kampanjer') : undefined} action={compact && rows.length > 5 ? <Button variant="ghost" size="sm" to="/creator/browse?type=campaigns">{t('Visa alla')}</Button> : undefined}>
      {isLoading ? <SkeletonList rows={3} /> : shown.length === 0 ? <Card><EmptyState title={t('Inga kampanjer tillgängliga')} description={t('Kom tillbaka senare — nya briefs släpps löpande.')} /></Card> : (
        <List>
          {shown.map((c) => {
            const s = status.get(c.id);
            return <ListRow key={c.id} leading={<Avatar name={c.brandName || c.name} rounded />} title={c.name}
              badge={s === 'Approved' ? <Badge tone="ok">{t('Godkänd')}</Badge> : s === 'Pending' ? <Badge tone="warn">{t('Ansökt')}</Badge> : s === 'Rejected' ? <Badge tone="bad">{t('Nekad')}</Badge> : c.spotsLeft <= 0 ? <Badge>{t('Fullbokad')}</Badge> : undefined}
              subtitle={`${c.brandName} · ${categoryLabel(c.category)} · ${payoutSummaryText(c.payoutSummary)} · ${plural(c.spotsLeft, t('plats kvar'), t('platser kvar'))}`} wrapSubtitle
              trailing={<IconButton label={saved.has(c.id) ? t('Ta bort från sparade') : t('Spara kampanj')} onClick={(e) => { e.preventDefault(); e.stopPropagation(); const save = !saved.has(c.id); toggleSave.mutate({ campaignId: c.id, save }, { onSuccess: () => toast.push(save ? t('Sparad') : t('Borttagen från Sparat'), 'success'), onError: () => toast.push(t('Kunde inte spara kampanjen'), 'error') }); }}><Bookmark fill={saved.has(c.id) ? 'currentColor' : 'none'} style={{ color: saved.has(c.id) ? 'var(--ds-accent)' : undefined }} /></IconButton>}
              chevron={false} to={`/creator/campaigns/${c.id}`} />;
          })}
        </List>
      )}
      {!compact && pages > 1 && <div className="ds-row" style={{ justifyContent: 'space-between' }}><Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('Föregående')}</Button><span className="ds-caption ds-muted">{page} / {pages}</span><Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t('Nästa')}</Button></div>}
    </Section>
  );
}

function TapList({ term, compact }: { term: string; compact: boolean }) {
  const { data: communities = [], isLoading } = useMyCommunities();
  const { data: taps = [] } = useCreatorTaps();
  const inTap = new Set(taps.map((x) => x.brandProfileId));
  const rows = communities.filter((c) => !term || c.brandName.toLowerCase().includes(term));
  if (compact && rows.length === 0) return null;
  return (
    <Section title={t('Kranar')}>
      {isLoading ? <SkeletonList rows={2} /> : rows.length === 0 ? (
        <Card><EmptyState title={t('Inga kranar att hämta ur än')} description={t('Kör en kampanj för ett företag så kvalificerar du in i deras community — eller ansök till kranen direkt från företagets profil.')} /></Card>
      ) : (
        <List>
          {rows.slice(0, compact ? 3 : undefined).map((c) => (
            <ListRow key={c.brandProfileId} leading={<Avatar name={c.brandName} src={c.brandLogoUrl} rounded />} title={c.brandName} badge={inTap.has(c.brandProfileId) ? <Badge tone="ok">{t('Du hämtar')}</Badge> : c.hasActiveTap ? <Badge tone="accent">{t('Öppen kran')}</Badge> : <Badge>{t('Ingen kran öppen')}</Badge>} subtitle={`${t('Medlem i communityn sedan')} ${formatDate(c.joinedAt)}`} to={`/creator/brands/${c.brandProfileId}`} />
          ))}
        </List>
      )}
      {!compact && <p className="ds-caption ds-muted">{t('Nya kranar öppnas av företag du redan jobbat med. Följ företag i flödet så ser du när de öppnar.')}</p>}
    </Section>
  );
}

function VideoJobList({ term, compact }: { term: string; compact: boolean }) {
  const [matching, setMatching] = useState(true);
  const { data: jobs = [], isLoading } = useUgcCreatorCampaigns(matching);
  const rows = jobs.filter((c) => !term || `${c.title} ${c.brandName}`.toLowerCase().includes(term));
  if (compact && rows.length === 0 && !isLoading) return null;
  return (
    <Section title={t('Videouppdrag')} action={compact ? <Button variant="ghost" size="sm" to="/creator/browse?type=video">{t('Visa alla')}</Button> : <Chip selected={matching} onClick={() => setMatching((v) => !v)}>{t('Passar dig')}</Chip>}>
      {isLoading ? <SkeletonList rows={2} /> : rows.length === 0 ? <Card><EmptyState title={t('Inga öppna beställningar just nu')} description={matching ? t('Prova att stänga av "Passar dig", eller fyll i kategorier och stad under Inställningar › Videouppdrag.') : t('Du får en notis så fort ett företag publicerar något som passar dig.')} /></Card> : (
        <List>
          {rows.slice(0, compact ? 3 : undefined).map((c) => (
            <ListRow key={c.id} leading={<Avatar name={c.brandName} src={c.brandLogoUrl} rounded />} title={c.title}
              badge={c.myCollabId ? <Badge tone="ok">{t('Anlitad')}</Badge> : c.myApplicationStatus ? <Badge tone="warn">{t('Ansökt')}</Badge> : undefined}
              subtitle={`${c.brandName} · ${c.compensation === 'ProductExchange' ? t('Produkt') : `${formatOre(c.budgetMinOre)}–${formatOre(c.budgetMaxOre)}`} · ${c.brief.lengthSeconds} s · ${c.deadlineDays} ${t('dagar')}`} wrapSubtitle
              to={c.myCollabId ? `/creator/ugc/collabs/${c.myCollabId}` : `/creator/ugc/orders/${c.id}`} />
          ))}
        </List>
      )}
    </Section>
  );
}
