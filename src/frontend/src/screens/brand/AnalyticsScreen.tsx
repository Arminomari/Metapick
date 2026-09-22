/**
 * Brand Statistik: four segments, four numbers at a time above the fold.
 * Every campaign figure comes from GET /brand/analytics/summary: verified
 * posts only, drafts never counted, insights only above a minimum sample.
 * Taps, community and video orders keep their own server-computed sources.
 */
import { useNavigate, useSearchParams } from 'react-router-dom';
import { t } from '@/lib/i18n';
import { money, formatNumber } from '@/lib/utils';
import { useBrandAnalyticsSummary, usePrStats } from '@/hooks/api';
import { useUgcCollabs, formatOre } from '@/hooks/ugc';
import { useBrandTaps, useCommunityMembers } from '@/hooks/extra';
import type { Insight } from '@/types';
import { Avatar, Button, Card, EmptyState, List, ListRow, Page, PageHead, SegmentedControl, Section, SkeletonList, StatRow, StatTile } from '@/components/ds';
import { Bars, Donut, LineChart, PALETTE } from '@/components/app/Charts';
import { SourceNote, orDash } from '@/components/app/SourceNote';

type Seg = 'overview' | 'performance' | 'platforms' | 'money';
const kr2 = (n: number) => `${n.toFixed(2)} kr`;
const pct = (n: number) => `${n.toFixed(2)} %`;
const short = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace('.0', '') + 'K' : String(Math.round(n));
const clamp = (n: number) => Math.max(0, Math.min(100, n));

function insightText(i: Insight): string {
  switch (i.kind) {
    case 'LowestCpmCampaign': return `${i.subject} ${t('levererar din lägsta CPM')}: ${kr2(i.value)} (${i.sampleSize} ${t('kampanjer')}).`;
    case 'BestDuration': return `${t('Videor på')} ${i.subject} ${t('drar flest visningar i snitt')} (${short(i.value)}, ${i.sampleSize} ${t('videor')}).`;
    case 'BestDaypart': return `${t('Bäst att posta')}: ${i.subject.toLowerCase()}, ${short(i.value)} ${t('visningar i snitt')} (${i.sampleSize} ${t('videor')}).`;
    default: return `${i.subject}: ${i.value}`;
  }
}

export function BrandAnalyticsScreen() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const seg = (params.get('tab') as Seg) || 'overview';
  const { data: s, isLoading } = useBrandAnalyticsSummary();
  const { data: pr } = usePrStats();
  const { data: taps = [] } = useBrandTaps();
  const { data: members = [] } = useCommunityMembers();
  const { data: collabs = [] } = useUgcCollabs('brand');

  const tapBudget = taps.filter((x) => x.status === 'Active').reduce((sum, x) => sum + x.monthlyBudget, 0);
  const tapSpent = taps.filter((x) => x.status === 'Active').reduce((sum, x) => sum + x.monthSpent, 0);
  const ugcSpent = collabs.filter((c) => c.status === 'Paid').reduce((sum, c) => sum + c.brandTotalOre, 0);
  const communityEarned = members.reduce((sum, m) => sum + m.lifetimeEarned, 0);
  const chartRows = s ? [...s.campaigns].filter((r) => r.views > 0).slice(0, 10).reverse() : [];
  const engagement = s ? s.totalLikes + s.totalComments + s.totalShares : 0;

  return (
    <Page>
      <PageHead title={t('Statistik')} back={{ onClick: () => navigate(-1) }} />
      <SegmentedControl<Seg> segments={[{ key: 'overview', label: t('Översikt') }, { key: 'performance', label: t('Prestation') }, { key: 'platforms', label: t('Plattformar') }, { key: 'money', label: t('Pengar') }]} value={seg} onChange={(k) => setParams({ tab: k }, { replace: true })} />
      {isLoading || !s ? <SkeletonList rows={3} /> : s.campaignsInScope === 0 && taps.length === 0 ? (
        <Card><EmptyState title={t('Ingen analys än')} description={t('Öppna en kran eller lansera en kampanj så börjar vi mäta visningar, engagemang och CPM.')} action={<Button to="/brand/tap/new">{t('Öppna en kran')}</Button>} /></Card>
      ) : seg === 'overview' ? (
        <>
          {s.totalViews === 0 && <Card><p className="ds-body ds-muted">{t('Inga verifierade visningar ännu. Analysen fylls i så snart creators content går live.')}</p></Card>}
          <StatRow cols={4}>
            <StatTile label={t('Visningar')} value={formatNumber(s.totalViews)} hint={`${s.creators} ${t('creators')} · ${s.verifiedPosts} ${t('verifierade videor')}`} />
            <StatTile label={t('Spend')} value={money(s.totalSpent)} hint={`${money(s.remainingBudget)} ${t('kvar i pågående')}`} />
            <StatTile label="CPM" value={orDash(s.cpm, kr2)} hint={t('kostnad / 1 000 visn.')} />
            <StatTile label={t('Snitt / post')} value={orDash(s.avgViewsPerPost, short)} hint={`${formatNumber(s.views24h)} ${t('senaste dygnet')}`} />
          </StatRow>
          <SourceNote source="tiktok" at={s.metricsUpdatedAt} scope={s.scope} />
          <Card title={t('Attention efficiency score')}>
            {s.attentionScore != null ? (
              <>
                <Donut segments={[{ value: s.attentionScore, color: PALETTE[0] }, { value: 100 - s.attentionScore, color: 'transparent' }]}><span className="ds-heading ds-num">{s.attentionScore}</span><span className="ds-caption ds-muted">{t('av 100')}</span></Donut>
                <div style={{ marginTop: 12 }}><Bars rows={[{ label: t('Engagemang'), value: clamp((s.engagementRate ?? 0) * 8), display: orDash(s.engagementRate, pct) }, { label: t('Delningar'), value: clamp((s.shareRate ?? 0) * 40), display: orDash(s.shareRate, pct) }, { label: t('Klick'), value: clamp((s.clickThroughRate ?? 0) * 20), display: orDash(s.clickThroughRate, pct) }]} /></div>
                <p className="ds-caption ds-muted" style={{ marginTop: 8 }}>{s.attentionScoreFormula}</p>
              </>
            ) : <p className="ds-body ds-muted">{t('Visas när minst')} {s.attentionScoreMinPosts} {t('verifierade videor och')} {formatNumber(s.attentionScoreMinViews)} {t('visningar finns.')}</p>}
          </Card>
          <Card><div className="ds-facts"><div className="ds-fact"><span>{t('Engagemang')}</span><span className="ds-num">{formatNumber(engagement)} · ER {orDash(s.engagementRate, pct)}</span></div><div className="ds-fact"><span>{t('Klick')}</span><span className="ds-num">{formatNumber(s.totalClicks)} · CTR {orDash(s.clickThroughRate, pct)}</span></div><div className="ds-fact"><span>{t('Community')}</span><span className="ds-num">{members.filter((m) => m.status === 'Active').length} {t('medlemmar')} · {members.filter((m) => m.source === 'AutoQualified').length} {t('kvalificerade')}</span></div></div></Card>
          <Section title={t('Insikter')}>
            <Card>
              {s.insights.length > 0
                ? <ul className="ds-body" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>{s.insights.map((i) => <li key={i.kind}>{insightText(i)}</li>)}</ul>
                : <p className="ds-body ds-muted">{t('För lite data för insikter än — kör fler kampanjer.')} {t('En insikt kräver minst')} {s.thresholds.minVideosPerBucket} {t('videor per grupp och')} {s.thresholds.minCampaignsForCpm} {t('kampanjer med över')} {formatNumber(s.thresholds.minViewsPerCampaignForCpm)} {t('visningar.')}</p>}
            </Card>
          </Section>
        </>
      ) : seg === 'performance' ? (
        <>
          <Section title={t('Visningar per kampanj')}><Card>{chartRows.length >= 2 ? <LineChart values={chartRows.map((x) => x.views)} labels={chartRows.map((x) => x.name)} fmt={short} /> : <p className="ds-body ds-muted">{t('Kör fler kampanjer så ritas din visningstrend här.')}</p>}</Card></Section>
          <Section title={t('Bästa creators')} action={<Button variant="ghost" size="sm" to="/brand/creators?tab=find">{t('Hitta fler')}</Button>}>
            {s.bestCreators.length === 0 ? <Card><p className="ds-body ds-muted">{t('Inga creators med data än.')}</p></Card> : <List>{s.bestCreators.map((c) => <ListRow key={c.creatorProfileId} leading={<Avatar name={c.displayName} src={c.avatarUrl} size="sm" />} title={c.displayName} subtitle={`${orDash(c.costPerThousand, kr2)} / 1K · ${money(c.payout)}`} value={`${formatNumber(c.views)} views`} to={`/brand/campaigns/${c.campaignId}/creators/${c.assignmentId}`} />)}</List>}
          </Section>
          <Section title={t('Kvalitetssignaler')}><Card><Bars rows={[{ label: t('Engagement rate'), value: clamp((s.engagementRate ?? 0) * 8), display: orDash(s.engagementRate, pct) }, { label: t('Share rate'), value: clamp((s.shareRate ?? 0) * 40), display: orDash(s.shareRate, pct) }, { label: t('Klickfrekvens'), value: clamp((s.clickThroughRate ?? 0) * 20), display: orDash(s.clickThroughRate, pct) }, { label: t('Viral rate (100K+)'), value: clamp((s.viralRate ?? 0) * 10), display: orDash(s.viralRate, (v) => `${v.toFixed(1)} %`) }]} /><div className="ds-facts" style={{ marginTop: 12 }}><div className="ds-fact"><span>{t('Videor över 100K / 500K / 1M')}</span><span className="ds-num">{s.videosOver100K} / {s.videosOver500K} / {s.videosOver1M}</span></div></div><SourceNote source="tiktok" at={s.metricsUpdatedAt} scope={t('verifierade videor')} /></Card></Section>
          {s.byCategory.length > 0 && <Section title={t('Per nisch')}><List>{s.byCategory.map((n) => <ListRow key={n.category} title={n.category} subtitle={`${formatNumber(n.views)} views · ER ${orDash(n.engagementRate, pct)}`} value={`${orDash(n.cpm, kr2)} CPM`} chevron={false} />)}</List></Section>}
          {s.topContent.length > 0 && <Section title={t('Bäst presterande content')}><List>{s.topContent.map((v, i) => <ListRow key={i} leading={<Avatar name={v.creatorName} size="sm" />} title={v.creatorName} subtitle={`${formatNumber(v.likes + v.comments + v.shares)} ${t('engagemang')}${v.durationSeconds ? ` · ${v.durationSeconds} s` : ''}`} value={`${formatNumber(v.views)} views`} to={`/brand/campaigns/${v.campaignId}/creators/${v.assignmentId}`} />)}</List></Section>}
          {pr && pr.totalSent > 0 && <Section title={t('PR-utskick')}><Card><div className="ds-facts"><div className="ds-fact"><span>{t('Skickade')}</span><span className="ds-num">{pr.totalSent}</span></div><div className="ds-fact"><span>{t('Sedda')}</span><span className="ds-num">{pr.viewed}</span></div><div className="ds-fact"><span>{t('Accepterade')}</span><span className="ds-num">{pr.accepted} ({Math.round((pr.accepted / pr.totalSent) * 100)} %)</span></div><div className="ds-fact"><span>{t('Nekade')}</span><span className="ds-num">{pr.declined}</span></div>{pr.byCategory.map((c) => <div key={c.category} className="ds-fact"><span>· {c.category}</span><span className="ds-num">{c.count}</span></div>)}</div></Card></Section>}
          <Card><div className="ds-facts"><div className="ds-fact"><span>{t('Levererade videouppdrag')}</span><span className="ds-num">{collabs.filter((c) => c.status === 'Paid').length}</span></div></div></Card>
        </>
      ) : seg === 'platforms' ? (
        <>
          <Section title="TikTok">
            <Card>
              <Donut segments={[{ value: s.totalLikes, color: PALETTE[0], label: t('Gilla') }, { value: s.totalComments, color: PALETTE[1], label: t('Kommentarer') }, { value: s.totalShares, color: PALETTE[2], label: t('Delningar') }]}><span className="ds-heading ds-num">{orDash(s.engagementRate, pct)}</span><span className="ds-caption ds-muted">ER</span></Donut>
              <p className="ds-caption ds-muted" style={{ marginTop: 8 }}>{t('Sparningar exponeras inte av TikTok:s API och visas därför inte.')}</p>
              <SourceNote source="tiktok" at={s.metricsUpdatedAt} scope={t('verifierade videor')} />
            </Card>
          </Section>
          <Section title={t('Prestanda per videolängd')}><Card>{s.durationBuckets.some((b) => b.count > 0) ? <Bars rows={s.durationBuckets.filter((b) => b.count > 0).map((b) => ({ label: `${b.label} · ${b.count} ${t('videor')}`, value: b.avgViews, display: short(b.avgViews) }))} /> : <p className="ds-body ds-muted">{t('Videolängd registreras när posts synkas från TikTok.')}</p>}</Card></Section>
          <Section title={t('Bästa publiceringstid')}><Card>{s.dayparts.some((b) => b.count > 0) ? <Bars rows={[...s.dayparts].filter((b) => b.count > 0).sort((a, b) => b.avgViews - a.avgViews).map((b) => ({ label: `${b.label} · ${b.count} ${t('videor')}`, value: b.avgViews, display: short(b.avgViews) }))} /> : <p className="ds-body ds-muted">{t('Publiceringstid registreras när posts synkas från TikTok.')}</p>}<p className="ds-caption ds-muted" style={{ marginTop: 8 }}>{t('Tidszon')}: {s.timezone}</p></Card></Section>
          <Section title={t('Topp-hashtags')}><Card>{s.topHashtags.length ? <div className="ds-tags">{s.topHashtags.map((tg) => <span key={tg.tag} className="ds-tag">#{tg.tag} · {short(tg.views)} · {tg.count}×</span>)}</div> : <p className="ds-body ds-muted">{t('Hashtags läses ur posternas captions vid synk.')}</p>}</Card></Section>
          <Section title="Instagram"><Card><p className="ds-body ds-muted">{t('Instagram-data hämtas inte automatiskt ännu.')}</p></Card></Section>
        </>
      ) : (
        <>
          <StatRow cols={4}>
            <StatTile label={t('Budget')} value={money(s.totalBudget)} hint={`${s.campaignsInScope} ${t('kampanjer')}`} />
            <StatTile label={t('Spenderat')} value={money(s.totalSpent)} hint={s.totalBudget > 0 ? `${Math.round((s.totalSpent / s.totalBudget) * 100)} %` : '–'} />
            <StatTile label={t('Kranar / mån')} value={money(tapBudget)} hint={`${money(tapSpent)} ${t('använt')}`} />
            <StatTile label={t('Videouppdrag')} value={formatOre(ugcSpent)} hint={t('betalt totalt')} />
          </StatRow>
          <SourceNote source="ledger" at={s.calculatedAt} scope={s.scope} />
          <Card><div className="ds-facts"><div className="ds-fact"><span>{t('Kvar i pågående kampanjer')}</span><span className="ds-num">{money(s.remainingBudget)}</span></div><div className="ds-fact"><span>{t('Pågående kampanjer')}</span><span className="ds-num">{s.runningCampaigns}</span></div></div></Card>
          <Section title={t('Kostnad per')}><Card><div className="ds-facts">
            <div className="ds-fact"><span>{t('1 000 visningar (CPM)')}</span><span className="ds-num">{orDash(s.cpm, kr2)}</span></div>
            <div className="ds-fact"><span>{t('Klick (CPC)')}</span><span className="ds-num">{orDash(s.costPerClick, kr2)}</span></div>
            <div className="ds-fact"><span>{t('Engagemang (CPE)')}</span><span className="ds-num">{orDash(s.costPerEngagement, kr2)}</span></div>
            <div className="ds-fact"><span>{t('Post (CPP)')}</span><span className="ds-num">{orDash(s.costPerPost, kr2)}</span></div>
            <div className="ds-fact"><span>{t('Delning (CPSH)')}</span><span className="ds-num">{orDash(s.costPerShare, kr2)}</span></div>
            <div className="ds-fact"><span>{t('Visning')}</span><span className="ds-num">{orDash(s.costPerView, (v) => `${v.toFixed(3)} kr`)}</span></div>
          </div></Card></Section>
          {s.campaigns.length > 0 && <Section title={t('Spenderat per kampanj')}><Card><Bars rows={[...s.campaigns].sort((a, b) => b.spent - a.spent).slice(0, 8).map((x) => ({ label: x.name, value: x.spent, display: money(x.spent) }))} /></Card></Section>}
          {taps.length > 0 && <Section title={t('Kranar')}><List>{taps.map((x) => <ListRow key={x.id} title={x.name} subtitle={`${money(x.monthSpent)} ${t('av')} ${money(x.monthlyBudget)} · ${money(x.monthRemaining)} ${t('kvar')}`} value={`${x.monthUsedPercent} %`} to={`/brand/tap/${x.id}`} />)}</List></Section>}
          <Card><div className="ds-facts"><div className="ds-fact"><span>{t('Intjänat av communityn')}</span><span className="ds-num">{money(communityEarned)}</span></div></div></Card>
        </>
      )}
    </Page>
  );
}
