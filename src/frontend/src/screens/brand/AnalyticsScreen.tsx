/** Brand Statistik: the same 140 numbers, in four segments, four at a time above the fold. */
import { useNavigate, useSearchParams } from 'react-router-dom';
import { t } from '@/lib/i18n';
import { money, formatNumber } from '@/lib/utils';
import { useBrandAnalytics, usePrStats } from '@/hooks/api';
import { useUgcCollabs, formatOre } from '@/hooks/ugc';
import { useBrandTaps, useCommunityMembers } from '@/hooks/extra';
import type { CampaignAnalytics, CreatorVideo } from '@/types';
import { Avatar, Button, Card, EmptyState, List, ListRow, Page, PageHead, SegmentedControl, Section, SkeletonList, StatRow, StatTile } from '@/components/ds';
import { Bars, Donut, LineChart, PALETTE } from '@/components/app/Charts';

type Seg = 'overview' | 'performance' | 'platforms' | 'money';
const kr2 = (n: number) => `${n.toFixed(2)} kr`;
const pct = (n: number) => `${n.toFixed(2)} %`;
const short = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace('.0', '') + 'K' : String(Math.round(n));
const clamp = (n: number) => Math.max(0, Math.min(100, n));
const sum = <T,>(arr: T[], f: (x: T) => number) => arr.reduce((s, x) => s + (f(x) || 0), 0);

export function BrandAnalyticsScreen() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const seg = (params.get('tab') as Seg) || 'overview';
  const { campaigns, analytics, isLoading } = useBrandAnalytics();
  const { data: pr } = usePrStats();
  const { data: taps = [] } = useBrandTaps();
  const { data: members = [] } = useCommunityMembers();
  const { data: collabs = [] } = useUgcCollabs('brand');

  const byId = new Map(campaigns.map((c) => [c.id, c]));
  const joined = analytics.map((a) => ({ a, c: byId.get(a.campaignId) })).filter((x) => x.c) as { a: CampaignAnalytics; c: typeof campaigns[number] }[];
  const TV = sum(analytics, (a) => a.totalViews), TS = sum(analytics, (a) => a.budgetSpent), TC = sum(analytics, (a) => a.totalClicks), TP = sum(analytics, (a) => a.totalPosts);
  const likes = sum(analytics, (a) => a.totalLikes), comments = sum(analytics, (a) => a.totalComments), shares = sum(analytics, (a) => a.totalShares), saves = sum(analytics, (a) => a.totalSaves);
  const TE = likes + comments + shares + saves, views24h = sum(analytics, (a) => a.views24h), remaining = sum(analytics, (a) => a.budgetRemaining), creators = sum(analytics, (a) => a.totalCreators);
  const CPM = TV ? (TS / TV) * 1000 : 0, AVP = TP ? TV / TP : 0, ER = TV ? (TE / TV) * 100 : 0, CTR = TV ? (TC / TV) * 100 : 0, CPC = TC ? TS / TC : 0, CPE = TE ? TS / TE : 0, CPP = TP ? TS / TP : 0, CPSH = shares ? TS / shares : 0, SHR = TV ? (shares / TV) * 100 : 0;
  const AES = Math.round(0.45 * clamp(ER * 8) + 0.25 * clamp(SHR * 40) + 0.3 * clamp(CTR * 20));
  type Vid = CreatorVideo & { creator: string; assignmentId: string; campaignId: string };
  const videos: Vid[] = analytics.flatMap((a) => a.creatorPerformance.flatMap((cp) => (cp.videos || []).map((v) => ({ ...v, creator: cp.displayName, assignmentId: cp.assignmentId, campaignId: a.campaignId })))).filter((v) => v.views > 0);
  const chartRows = [...joined].filter((x) => x.a.totalViews > 0).sort((x, y) => x.a.totalViews - y.a.totalViews).slice(-10);
  const creatorMap = new Map<string, { name: string; views: number; payout: number; assignmentId: string; campaignId: string }>();
  analytics.forEach((a) => a.creatorPerformance.forEach((cp) => { const e = creatorMap.get(cp.creatorId) ?? { name: cp.displayName, views: 0, payout: 0, assignmentId: cp.assignmentId, campaignId: a.campaignId }; e.views += cp.views || 0; e.payout += cp.payoutAmount || 0; creatorMap.set(cp.creatorId, e); }));
  const topCreators = [...creatorMap.values()].sort((a, b) => b.views - a.views).slice(0, 6);
  const nicheMap = new Map<string, { views: number; spend: number; eng: number }>();
  joined.forEach(({ a, c }) => { const e = nicheMap.get(c.category) ?? { views: 0, spend: 0, eng: 0 }; e.views += a.totalViews; e.spend += a.budgetSpent; e.eng += a.totalLikes + a.totalComments + a.totalShares; nicheMap.set(c.category, e); });
  const niches = [...nicheMap.entries()].map(([cat, v]) => ({ cat, ...v, cpm: v.views ? (v.spend / v.views) * 1000 : 0, er: v.views ? (v.eng / v.views) * 100 : 0 })).filter((n) => n.views > 0).sort((a, b) => b.views - a.views);
  const durBuckets: [number, number, string][] = [[0, 15, '0–15 s'], [15, 30, '15–30 s'], [30, 45, '30–45 s'], [45, 60, '45–60 s'], [60, 1e9, '60 s+']];
  const vpd = durBuckets.map(([lo, hi, label]) => { const vs = videos.filter((v) => (v.durationSeconds ?? -1) >= lo && (v.durationSeconds ?? -1) < hi); return { label, count: vs.length, avg: vs.length ? sum(vs, (v) => v.views) / vs.length : 0 }; }).filter((b) => b.count > 0);
  const dayparts = [{ label: t('Morgon 06–11'), lo: 6, hi: 12 }, { label: t('Dag 12–17'), lo: 12, hi: 18 }, { label: t('Kväll 18–23'), lo: 18, hi: 24 }, { label: t('Natt 00–05'), lo: 0, hi: 6 }];
  const bpt = dayparts.map((d) => { const vs = videos.filter((v) => { if (!v.publishedAt) return false; const h = new Date(v.publishedAt).getHours(); return h >= d.lo && h < d.hi; }); return { label: d.label, count: vs.length, avg: vs.length ? sum(vs, (v) => v.views) / vs.length : 0 }; }).filter((b) => b.count > 0).sort((a, b) => b.avg - a.avg);
  const tagMap = new Map<string, { count: number; views: number }>(); videos.forEach((v) => (v.hashtags || []).forEach((tg) => { const e = tagMap.get(tg) ?? { count: 0, views: 0 }; e.count++; e.views += v.views; tagMap.set(tg, e); }));
  const topTags = [...tagMap.entries()].map(([tag, v]) => ({ tag, ...v })).sort((a, b) => b.views - a.views).slice(0, 8);
  const viral = [100_000, 500_000, 1_000_000].map((th) => videos.filter((v) => v.views >= th).length);
  const viralRate = videos.length ? (viral[0] / videos.length) * 100 : 0;
  const topContent = [...videos].sort((a, b) => b.views - a.views).slice(0, 6);
  const tapBudget = taps.filter((x) => x.status === 'Active').reduce((s, x) => s + x.monthlyBudget, 0), tapSpent = taps.reduce((s, x) => s + x.monthSpent, 0);
  const ugcSpent = collabs.filter((c) => c.status === 'Paid').reduce((s, c) => s + c.brandTotalOre, 0);
  const communityEarned = members.reduce((s, m) => s + m.lifetimeEarned, 0);
  const insights: string[] = [];
  const bestCpm = joined.filter((x) => x.a.totalViews > 0).map((x) => ({ name: x.c.name, cpm: (x.a.budgetSpent / x.a.totalViews) * 1000 })).sort((a, b) => a.cpm - b.cpm)[0];
  if (bestCpm) insights.push(`${bestCpm.name} ${t('levererar din lägsta CPM')}: ${kr2(bestCpm.cpm)}.`);
  if (vpd.length) { const best = [...vpd].sort((a, b) => b.avg - a.avg)[0]; insights.push(`${t('Videor på')} ${best.label} ${t('drar flest visningar i snitt')} (${short(best.avg)}).`); }
  if (bpt.length) insights.push(`${t('Bäst att posta')}: ${bpt[0].label.toLowerCase()}, ${short(bpt[0].avg)} ${t('visningar i snitt')}.`);
  const hasData = TV > 0;

  return (
    <Page>
      <PageHead title={t('Statistik')} back={{ onClick: () => navigate(-1) }} />
      <SegmentedControl<Seg> segments={[{ key: 'overview', label: t('Översikt') }, { key: 'performance', label: t('Prestation') }, { key: 'platforms', label: t('Plattformar') }, { key: 'money', label: t('Pengar') }]} value={seg} onChange={(k) => setParams({ tab: k }, { replace: true })} />
      {isLoading ? <SkeletonList rows={3} /> : campaigns.length === 0 && taps.length === 0 ? (
        <Card><EmptyState title={t('Ingen analys än')} description={t('Öppna en kran eller lansera en kampanj så börjar vi mäta visningar, engagemang och CPM.')} action={<Button to="/brand/tap/new">{t('Öppna en kran')}</Button>} /></Card>
      ) : seg === 'overview' ? (
        <>
          {!hasData && <Card><p className="ds-body ds-muted">{t('Inga verifierade visningar ännu. Analysen fylls i så snart creators content går live.')}</p></Card>}
          <StatRow cols={4}>
            <StatTile label={t('Visningar')} value={formatNumber(TV)} hint={`${creators} ${t('creators')} · ${TP} ${t('posts')}`} />
            <StatTile label={t('Spend')} value={money(TS)} hint={`${money(remaining)} ${t('kvar')}`} />
            <StatTile label="CPM" value={kr2(CPM)} hint={t('kostnad / 1 000 visn.')} />
            <StatTile label={t('Snitt / post')} value={short(AVP)} hint={`${formatNumber(views24h)} ${t('senaste dygnet')}`} />
          </StatRow>
          <Card title={t('Attention efficiency score')}>
            <Donut segments={[{ value: AES, color: PALETTE[0] }, { value: 100 - AES, color: 'transparent' }]}><span className="ds-heading ds-num">{AES}</span><span className="ds-caption ds-muted">{t('av 100')}</span></Donut>
            <div style={{ marginTop: 12 }}><Bars rows={[{ label: t('Engagemang'), value: clamp(ER * 8), display: pct(ER) }, { label: t('Delningar'), value: clamp(SHR * 40), display: pct(SHR) }, { label: t('Klick'), value: clamp(CTR * 20), display: pct(CTR) }]} /></div>
            <p className="ds-caption ds-muted" style={{ marginTop: 8 }}>{t('Vägt index av engagemang, delningar och klickfrekvens. Allt från verifierad data.')}</p>
          </Card>
          <Card><div className="ds-facts"><div className="ds-fact"><span>{t('Engagemang')}</span><span className="ds-num">{formatNumber(TE)} · ER {pct(ER)}</span></div><div className="ds-fact"><span>{t('Klick')}</span><span className="ds-num">{formatNumber(TC)} · CTR {pct(CTR)}</span></div><div className="ds-fact"><span>{t('Community')}</span><span className="ds-num">{members.filter((m) => m.status === 'Active').length} {t('medlemmar')} · {members.filter((m) => m.source === 'AutoQualified').length} {t('kvalificerade')}</span></div></div></Card>
          {insights.length > 0 && <Section title={t('Insikter')}><Card><ul className="ds-body" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>{insights.map((s, i) => <li key={i}>{s}</li>)}</ul></Card></Section>}
        </>
      ) : seg === 'performance' ? (
        <>
          <Section title={t('Visningar per kampanj')}><Card>{chartRows.length >= 2 ? <LineChart values={chartRows.map((x) => x.a.totalViews)} labels={chartRows.map((x) => x.c.name)} fmt={short} /> : <p className="ds-body ds-muted">{t('Kör fler kampanjer så ritas din visningstrend här.')}</p>}</Card></Section>
          <Section title={t('Bästa creators')} action={<Button variant="ghost" size="sm" to="/brand/creators?tab=find">{t('Hitta fler')}</Button>}>
            {topCreators.length === 0 ? <Card><p className="ds-body ds-muted">{t('Inga creators med data än.')}</p></Card> : <List>{topCreators.map((c) => <ListRow key={c.name} leading={<Avatar name={c.name} size="sm" />} title={c.name} subtitle={`${c.views && c.payout ? `${kr2((c.payout / c.views) * 1000)} / 1K` : '–'} · ${money(c.payout)}`} value={`${formatNumber(c.views)} views`} to={`/brand/campaigns/${c.campaignId}/creators/${c.assignmentId}`} />)}</List>}
          </Section>
          <Section title={t('Kvalitetssignaler')}><Card><Bars rows={[{ label: t('Engagement rate'), value: clamp(ER * 8), display: pct(ER) }, { label: t('Share rate'), value: clamp(SHR * 40), display: pct(SHR) }, { label: t('Klickfrekvens'), value: clamp(CTR * 20), display: pct(CTR) }, { label: t('Viral rate (100K+)'), value: clamp(viralRate * 10), display: pct(viralRate) }]} /><div className="ds-facts" style={{ marginTop: 12 }}><div className="ds-fact"><span>{t('Videor över 100K / 500K / 1M')}</span><span className="ds-num">{viral.join(' / ')}</span></div></div></Card></Section>
          {niches.length > 0 && <Section title={t('Per nisch')}><List>{niches.slice(0, 6).map((n) => <ListRow key={n.cat} title={n.cat} subtitle={`${formatNumber(n.views)} views · ER ${pct(n.er)}`} value={`${kr2(n.cpm)} CPM`} chevron={false} />)}</List></Section>}
          {topContent.length > 0 && <Section title={t('Bäst presterande content')}><List>{topContent.map((v, i) => <ListRow key={i} leading={<Avatar name={v.creator} size="sm" />} title={v.creator} subtitle={`${formatNumber(v.likes + v.comments + v.shares)} ${t('engagemang')} · ${formatNumber(v.clicks)} ${t('klick')}${v.durationSeconds ? ` · ${v.durationSeconds} s` : ''}`} value={`${formatNumber(v.views)} views`} to={`/brand/campaigns/${v.campaignId}/creators/${v.assignmentId}`} />)}</List></Section>}
          {pr && pr.totalSent > 0 && <Section title={t('PR-utskick')}><Card><div className="ds-facts"><div className="ds-fact"><span>{t('Skickade')}</span><span className="ds-num">{pr.totalSent}</span></div><div className="ds-fact"><span>{t('Sedda')}</span><span className="ds-num">{pr.viewed}</span></div><div className="ds-fact"><span>{t('Accepterade')}</span><span className="ds-num">{pr.accepted} ({Math.round((pr.accepted / pr.totalSent) * 100)} %)</span></div><div className="ds-fact"><span>{t('Nekade')}</span><span className="ds-num">{pr.declined}</span></div>{pr.byCategory.map((c) => <div key={c.category} className="ds-fact"><span>· {c.category}</span><span className="ds-num">{c.count}</span></div>)}</div></Card></Section>}
          <Card><div className="ds-facts"><div className="ds-fact"><span>{t('Levererade videouppdrag')}</span><span className="ds-num">{collabs.filter((c) => c.status === 'Paid').length}</span></div></div></Card>
        </>
      ) : seg === 'platforms' ? (
        <>
          <Section title="TikTok">
            <Card>
              <Donut segments={[{ value: likes, color: PALETTE[0], label: t('Gilla') }, { value: comments, color: PALETTE[1], label: t('Kommentarer') }, { value: shares, color: PALETTE[2], label: t('Delningar') }, { value: saves, color: PALETTE[3], label: t('Sparningar') }]}><span className="ds-heading ds-num">{pct(ER)}</span><span className="ds-caption ds-muted">ER</span></Donut>
              <p className="ds-caption ds-muted" style={{ marginTop: 8 }}>{t('Sparningar exponeras inte av TikTok ännu och visas därför som 0.')}</p>
            </Card>
          </Section>
          <Section title={t('Prestanda per videolängd')}><Card>{vpd.length ? <Bars rows={vpd.map((b) => ({ label: `${b.label} · ${b.count} ${t('posts')}`, value: b.avg, display: short(b.avg) }))} /> : <p className="ds-body ds-muted">{t('Videolängd registreras när posts synkas från TikTok.')}</p>}</Card></Section>
          <Section title={t('Bästa publiceringstid')}><Card>{bpt.length ? <Bars rows={bpt.map((b) => ({ label: b.label, value: b.avg, display: short(b.avg) }))} /> : <p className="ds-body ds-muted">{t('Publiceringstid registreras när posts synkas från TikTok.')}</p>}</Card></Section>
          <Section title={t('Topp-hashtags')}><Card>{topTags.length ? <div className="ds-tags">{topTags.map((tg) => <span key={tg.tag} className="ds-tag">#{tg.tag} · {short(tg.views)} · {tg.count}×</span>)}</div> : <p className="ds-body ds-muted">{t('Hashtags läses ur posternas captions vid synk.')}</p>}</Card></Section>
          <Section title="Instagram"><Card><p className="ds-body ds-muted">{t('Instagram-data hämtas inte automatiskt ännu.')}</p></Card></Section>
        </>
      ) : (
        <>
          <StatRow cols={4}>
            <StatTile label={t('Budget')} value={money(TS + remaining)} />
            <StatTile label={t('Spenderat')} value={money(TS)} hint={`${TS + remaining ? Math.round((TS / (TS + remaining)) * 100) : 0} %`} />
            <StatTile label={t('Kranar / mån')} value={money(tapBudget)} hint={`${money(tapSpent)} ${t('använt')}`} />
            <StatTile label={t('Videouppdrag')} value={formatOre(ugcSpent)} hint={t('betalt totalt')} />
          </StatRow>
          <Section title={t('Kostnad per')}><Card><div className="ds-facts">
            <div className="ds-fact"><span>{t('1 000 visningar (CPM)')}</span><span className="ds-num">{kr2(CPM)}</span></div>
            <div className="ds-fact"><span>{t('Klick (CPC)')}</span><span className="ds-num">{kr2(CPC)}</span></div>
            <div className="ds-fact"><span>{t('Engagemang (CPE)')}</span><span className="ds-num">{TE ? kr2(CPE) : '–'}</span></div>
            <div className="ds-fact"><span>{t('Post (CPP)')}</span><span className="ds-num">{TP ? kr2(CPP) : '–'}</span></div>
            <div className="ds-fact"><span>{t('Delning (CPSH)')}</span><span className="ds-num">{shares ? kr2(CPSH) : '–'}</span></div>
            <div className="ds-fact"><span>{t('Visning')}</span><span className="ds-num">{TV ? `${(TS / TV).toFixed(3)} kr` : '–'}</span></div>
            <div className="ds-fact"><span>{t('Sparning (CPS)')}</span><span className="ds-muted">{t('ej från TikTok ännu')}</span></div>
          </div></Card></Section>
          {joined.length > 0 && <Section title={t('Spenderat per kampanj')}><Card><Bars rows={[...joined].sort((a, b) => b.a.budgetSpent - a.a.budgetSpent).slice(0, 8).map((x) => ({ label: x.c.name, value: x.a.budgetSpent, display: money(x.a.budgetSpent) }))} /></Card></Section>}
          {taps.length > 0 && <Section title={t('Kranar')}><List>{taps.map((x) => <ListRow key={x.id} title={x.name} subtitle={`${money(x.monthSpent)} ${t('av')} ${money(x.monthlyBudget)} · ${money(x.monthRemaining)} ${t('kvar')}`} value={`${x.monthlyBudget ? Math.round((x.monthSpent / x.monthlyBudget) * 100) : 0} %`} to={`/brand/tap/${x.id}`} />)}</List></Section>}
          <Card><div className="ds-facts"><div className="ds-fact"><span>{t('Intjänat av communityn')}</span><span className="ds-num">{money(communityEarned)}</span></div></div></Card>
        </>
      )}
      <p className="ds-caption ds-muted" style={{ textAlign: 'center' }}>{t('Allt bygger på verifierad visnings-, klick-, engagemangs- och spend-data.')}</p>
    </Page>
  );
}
