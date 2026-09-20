/** Everything a brand runs: kranar, kampanjer, beställningar. One list, three segments. */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { t, statusLabel } from '@/lib/i18n';
import { money, formatDate, categoryLabel } from '@/lib/utils';
import { useBrandCampaigns } from '@/hooks/api';
import { useUgcBrandCampaigns, useUgcCollabs, formatOre, COMPENSATION_LABEL, collabStatusLabel } from '@/hooks/ugc';
import { useBrandTaps } from '@/hooks/extra';
import { Avatar, Badge, Button, Card, Chip, Chips, EmptyState, List, ListRow, Page, PageHead, SegmentedControl, Section, SkeletonList, statusTone } from '@/components/ds';
import { NotifBell } from '@/components/app/common';

type Tab = 'taps' | 'campaigns' | 'orders';

export function BrandProgramsScreen() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'taps';
  const navigate = useNavigate();
  return (
    <Page>
      <PageHead title={t('Kampanjer & kranar')} back={{ onClick: () => navigate('/brand') }} actions={<NotifBell />} />
      <SegmentedControl<Tab> segments={[{ key: 'taps', label: t('Kranar') }, { key: 'campaigns', label: t('Kampanjer') }, { key: 'orders', label: t('Beställningar') }]} value={tab} onChange={(k) => setParams({ tab: k }, { replace: true })} />
      {tab === 'taps' && <Taps />}
      {tab === 'campaigns' && <Campaigns />}
      {tab === 'orders' && <Orders />}
    </Page>
  );
}

function Taps() {
  const { data: taps = [], isLoading } = useBrandTaps();
  const [filter, setFilter] = useState<'all' | 'Active' | 'Paused'>('all');
  const rows = taps.filter((x) => filter === 'all' || x.status === filter);
  if (isLoading) return <SkeletonList rows={3} />;
  if (taps.length === 0) return <Card><EmptyState title={t('Ingen kran öppen')} description={t('En kran är en stående månadsbudget: din community publicerar när de vill och får betalt per verifierad view tills budgeten är nådd.')} action={<Button to="/brand/tap/new">{t('Öppna en kran')}</Button>} /></Card>;
  return (
    <>
      <Chips>{([['all', t('Alla')], ['Active', t('Öppna')], ['Paused', t('Pausade')]] as const).map(([k, l]) => <Chip key={k} selected={filter === k} onClick={() => setFilter(k)}>{l}</Chip>)}</Chips>
      <List>
        {rows.map((tap) => {
          const pct = tap.monthlyBudget > 0 ? Math.min(100, Math.round((tap.monthSpent / tap.monthlyBudget) * 100)) : 0;
          return <ListRow key={tap.id} leading={<Avatar name={tap.name} rounded />} title={tap.name} badge={<Badge tone={tap.status === 'Active' ? 'ok' : 'neutral'}>{tap.status === 'Active' ? t('Öppen') : t('Pausad')}</Badge>} subtitle={`#${tap.requiredHashtag} · ${tap.cpm} kr CPM · ${money(tap.monthSpent)} ${t('av')} ${money(tap.monthlyBudget)}`} wrapSubtitle value={`${pct} %`} to={`/brand/tap/${tap.id}`} />;
        })}
      </List>
    </>
  );
}

function Campaigns() {
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useBrandCampaigns(status, page);
  const rows = data?.data ?? [];
  const pages = data ? Math.ceil(data.totalCount / data.pageSize) : 1;
  const chips: [string | undefined, string][] = [[undefined, t('Alla')], ['Active', t('Aktiva')], ['Draft', t('Utkast')], ['PendingReview', t('Granskas')], ['Paused', t('Pausade')], ['Completed', t('Avslutade')]];
  return (
    <>
      <Chips>{chips.map(([k, l]) => <Chip key={l} selected={status === k} onClick={() => { setStatus(k); setPage(1); }}>{l}</Chip>)}</Chips>
      {isLoading ? <SkeletonList rows={3} /> : rows.length === 0 ? (
        <Card><EmptyState title={t('Inga kampanjer här')} description={status ? t('Byt filter eller skapa en ny kampanj.') : t('Skapa din första kampanj för att komma igång.')} action={<Button to="/brand/campaigns/new">{t('Skapa kampanj')}</Button>} /></Card>
      ) : (
        <List>
          {rows.map((c) => (
            <ListRow key={c.id} leading={<Avatar name={c.name} rounded />} title={c.name} badge={<Badge tone={statusTone(c.status)}>{statusLabel(c.status)}</Badge>} subtitle={`${categoryLabel(c.category)} · ${c.approvedCreatorCount}/${c.maxCreators} ${t('creators')} · ${formatDate(c.startDate)} – ${formatDate(c.endDate)}`} wrapSubtitle value={`${money(c.budgetSpent)} / ${money(c.budget)}`} to={`/brand/campaigns/${c.id}`} />
          ))}
        </List>
      )}
      {pages > 1 && <div className="ds-row" style={{ justifyContent: 'space-between' }}><Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('Föregående')}</Button><span className="ds-caption ds-muted">{page} / {pages}</span><Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t('Nästa')}</Button></div>}
    </>
  );
}

function Orders() {
  const { data: orders = [], isLoading } = useUgcBrandCampaigns();
  const { data: collabs = [] } = useUgcCollabs('brand');
  const [showDone, setShowDone] = useState(false);
  if (isLoading) return <SkeletonList rows={3} />;
  const needsMe = collabs.filter((c) => c.needsMyAction);
  const running = collabs.filter((c) => !c.needsMyAction && !['Paid', 'Cancelled', 'Approved'].includes(c.status));
  const done = collabs.filter((c) => ['Paid', 'Cancelled', 'Approved'].includes(c.status));
  const live = orders.filter((o) => o.status === 'Published');
  const drafts = orders.filter((o) => o.status === 'Draft');
  const closed = orders.filter((o) => o.status === 'Closed');
  if (orders.length + collabs.length === 0) return <Card><EmptyState title={t('Ingen beställning ännu')} description={t('Skriv en brief, sätt en budget per video och publicera. Creators som passar lägger bud — ni väljer.')} action={<Button to="/brand/ugc/campaigns/new">{t('Beställ video')}</Button>} /></Card>;

  const collabRow = (c: typeof collabs[number]) => (
    <ListRow key={c.id} leading={<Avatar name={c.creatorName} src={c.creatorAvatarUrl} />} title={c.title} badge={c.needsMyAction ? <Badge tone="accent">{t('Din tur')}</Badge> : <Badge tone={statusTone(c.status)}>{collabStatusLabel(c.status)}</Badge>}
      subtitle={`${c.creatorName} · ${c.compensation === 'ProductExchange' ? t('Produktbyte') : formatOre(c.brandTotalOre)}${c.deadlineAt && ['Accepted', 'InProgress', 'RevisionRequested'].includes(c.status) ? ` · ${t('deadline')} ${formatDate(c.deadlineAt)}` : ''}${c.autoApproveAt && c.status === 'Submitted' ? ` · ${t('auto-godkänns')} ${formatDate(c.autoApproveAt)}` : ''}`} wrapSubtitle
      to={`/brand/ugc/collabs/${c.id}`} />
  );
  const orderRow = (o: typeof orders[number]) => (
    <ListRow key={o.id} leading={<Avatar name={o.title} rounded />} title={o.title} badge={o.pendingApplicationCount > 0 ? <Badge tone="accent">{o.pendingApplicationCount} {t('nya bud')}</Badge> : undefined}
      subtitle={`${t(COMPENSATION_LABEL[o.compensation])} · ${o.compensation === 'ProductExchange' ? o.productDescription ?? '' : `${formatOre(o.budgetMinOre)}–${formatOre(o.budgetMaxOre)} / video`} · ${o.hiredCount}/${o.slots} ${t('anlitade')}`} wrapSubtitle
      to={o.status === 'Draft' ? `/brand/ugc/campaigns/${o.id}/edit` : `/brand/ugc/campaigns/${o.id}`} />
  );
  return (
    <>
      {needsMe.length > 0 && <Section title={t('Väntar på dig')}><List>{needsMe.map(collabRow)}</List></Section>}
      {live.length > 0 && <Section title={t('Öppna beställningar')}><List>{live.map(orderRow)}</List></Section>}
      {running.length > 0 && <div id="uppdrag"><Section title={t('Pågående uppdrag')}><List>{running.map(collabRow)}</List></Section></div>}
      {drafts.length > 0 && <Section title={t('Utkast')}><List>{drafts.map(orderRow)}</List></Section>}
      {(done.length + closed.length) > 0 && (
        <Section title={t('Klara')} action={<Button variant="ghost" size="sm" onClick={() => setShowDone((v) => !v)}>{showDone ? t('Dölj') : `${t('Visa')} (${done.length + closed.length})`}</Button>}>
          {showDone && <List>{done.map(collabRow)}{closed.map(orderRow)}</List>}
        </Section>
      )}
    </>
  );
}
