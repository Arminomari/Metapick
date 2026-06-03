import { Link } from 'react-router-dom';
import { useBrandAnalytics, useMarketBenchmarks } from '@/hooks/api';
import { AreaChart, Donut, MiniBars, BLUSH } from '@/components/vyrle/Viz';
import { formatNumber, formatCurrency } from '@/lib/utils';
import type { CampaignAnalytics, CreatorPerformance, CreatorVideo } from '@/types';

const GRADS = ['linear-gradient(135deg,#FFD8C7,#F1A88F)', 'linear-gradient(135deg,#cdb8f2,#9c7de0)', 'linear-gradient(135deg,#F2C58A,#e0a04e)', 'linear-gradient(135deg,#a9dcc0,#5fb98a)'];
const grad = (s: string) => GRADS[((s || '').charCodeAt(0) || 0) % GRADS.length];
const initial = (s: string) => (s?.[0] || '?').toUpperCase();
const kr2 = (n: number) => `${n.toFixed(2)} kr`;
const pct = (n: number) => `${n.toFixed(2)}%`;
const short = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace('.0', '') + 'K' : String(Math.round(n)));
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

type Vid = CreatorVideo & { creator: string };

export function BrandAnalyticsPage() {
  const { campaigns, analytics, isLoading } = useBrandAnalytics();
  const { data: market } = useMarketBenchmarks();

  const byId = new Map(campaigns.map((c) => [c.id, c]));
  const joined = analytics.map((a) => ({ a, c: byId.get(a.campaignId) })).filter((x) => x.c) as { a: CampaignAnalytics; c: typeof campaigns[number] }[];

  // ── core ──
  const TV = sum(analytics, (a) => a.totalViews);
  const TS = sum(analytics, (a) => a.budgetSpent);
  const TC = sum(analytics, (a) => a.totalClicks);
  const TP = sum(analytics, (a) => a.totalPosts);
  const likes = sum(analytics, (a) => a.totalLikes);
  const comments = sum(analytics, (a) => a.totalComments);
  const shares = sum(analytics, (a) => a.totalShares);
  const saves = sum(analytics, (a) => a.totalSaves); // 0 until TikTok exposes it
  const TE = likes + comments + shares + saves;
  const views24h = sum(analytics, (a) => a.views24h);
  const remaining = sum(analytics, (a) => a.budgetRemaining);
  const creators = sum(analytics, (a) => a.totalCreators);

  // ── derived ──
  const CPM = TV ? (TS / TV) * 1000 : 0;
  const AVP = TP ? TV / TP : 0;
  const ER = TV ? (TE / TV) * 100 : 0;
  const CTR = TV ? (TC / TV) * 100 : 0;
  const CPC = TC ? TS / TC : 0;
  const CPE = TE ? TS / TE : 0;
  const CPP = TP ? TS / TP : 0;
  const CPSH = shares ? TS / shares : 0;
  const SHR = TV ? (shares / TV) * 100 : 0;
  const costPerView = TV ? TS / TV : 0;
  const marketCpm = market?.marketCpm ?? 0;
  const cei = marketCpm > 0 && CPM > 0 ? (1 - CPM / marketCpm) * 100 : null; // +% = below market (cheaper)

  // ── all videos flattened (for content/duration/timing/hashtag/virality) ──
  const allVideos: Vid[] = analytics.flatMap((a) => a.creatorPerformance.flatMap((cp: CreatorPerformance) => (cp.videos || []).map((v) => ({ ...v, creator: cp.displayName }))));
  const liveVideos = allVideos.filter((v) => v.views > 0);

  // ── attention efficiency score (transparent composite of real signals) ──
  const engScore = clamp(ER * 8);
  const shareScore = clamp(SHR * 40);
  const ctrScore = clamp(CTR * 20);
  const effScore = marketCpm > 0 && CPM > 0 ? clamp((marketCpm / CPM) * 70) : (CPM > 0 ? 50 : 0);
  const AES = Math.round(0.3 * engScore + 0.2 * shareScore + 0.2 * ctrScore + 0.3 * effScore);

  // ── chart: views by campaign ──
  const chartRows = [...joined].filter((x) => x.a.totalViews > 0).sort((x, y) => x.a.totalViews - y.a.totalViews).slice(-10);

  // ── top creators ──
  const creatorMap = new Map<string, { name: string; views: number; clicks: number; payout: number }>();
  analytics.forEach((a) => a.creatorPerformance.forEach((cp) => {
    const e = creatorMap.get(cp.creatorId) ?? { name: cp.displayName, views: 0, clicks: 0, payout: 0 };
    e.views += cp.views || 0; e.clicks += cp.clicks || 0; e.payout += cp.payoutAmount || 0;
    creatorMap.set(cp.creatorId, e);
  }));
  const topCreators = [...creatorMap.values()].sort((a, b) => b.views - a.views).slice(0, 6);
  const maxCreatorViews = Math.max(1, ...topCreators.map((c) => c.views));

  // ── top content ──
  const topContent = [...liveVideos].sort((a, b) => b.views - a.views).slice(0, 6);

  // ── video performance by duration (VPD) ──
  const durBuckets = [[0, 15], [15, 30], [30, 45], [45, 60], [60, 1e9]] as const;
  const durLabels = ['0–15s', '15–30s', '30–45s', '45–60s', '60s+'];
  const vpd = durBuckets.map(([lo, hi], i) => {
    const vs = liveVideos.filter((v) => (v.durationSeconds ?? -1) >= lo && (v.durationSeconds ?? -1) < hi);
    const views = sum(vs, (v) => v.views);
    const eng = sum(vs, (v) => v.likes + v.comments + v.shares);
    return { label: durLabels[i], count: vs.length, avgViews: vs.length ? views / vs.length : 0, er: views ? (eng / views) * 100 : 0 };
  }).filter((b) => b.count > 0);
  const maxVpd = Math.max(1, ...vpd.map((b) => b.avgViews));

  // ── best posting times (BPT) ──
  const dayparts = [{ label: 'Morgon · 06–11', lo: 6, hi: 12 }, { label: 'Dag · 12–17', lo: 12, hi: 18 }, { label: 'Kväll · 18–23', lo: 18, hi: 24 }, { label: 'Natt · 00–05', lo: 0, hi: 6 }];
  const bpt = dayparts.map((d) => {
    const vs = liveVideos.filter((v) => { if (!v.publishedAt) return false; const h = new Date(v.publishedAt).getHours(); return h >= d.lo && h < d.hi; });
    const views = sum(vs, (v) => v.views);
    return { label: d.label, count: vs.length, avgViews: vs.length ? views / vs.length : 0 };
  }).filter((b) => b.count > 0).sort((a, b) => b.avgViews - a.avgViews);
  const maxBpt = Math.max(1, ...bpt.map((b) => b.avgViews));

  // ── top hashtags (TPH) ──
  const tagMap = new Map<string, { count: number; views: number }>();
  liveVideos.forEach((v) => (v.hashtags || []).forEach((t) => { const e = tagMap.get(t) ?? { count: 0, views: 0 }; e.count++; e.views += v.views; tagMap.set(t, e); }));
  const topTags = [...tagMap.entries()].map(([tag, v]) => ({ tag, ...v })).sort((a, b) => b.views - a.views).slice(0, 8);

  // ── niche performance (NP) ──
  const nicheMap = new Map<string, { views: number; spend: number; clicks: number; eng: number }>();
  joined.forEach(({ a, c }) => {
    const e = nicheMap.get(c.category) ?? { views: 0, spend: 0, clicks: 0, eng: 0 };
    e.views += a.totalViews; e.spend += a.budgetSpent; e.clicks += a.totalClicks; e.eng += a.totalLikes + a.totalComments + a.totalShares;
    nicheMap.set(c.category, e);
  });
  const niches = [...nicheMap.entries()].map(([cat, v]) => ({ cat, ...v, cpm: v.views ? (v.spend / v.views) * 1000 : 0, er: v.views ? (v.eng / v.views) * 100 : 0 })).filter((n) => n.views > 0).sort((a, b) => b.views - a.views);
  const marketCat = new Map((market?.byCategory ?? []).map((n) => [n.category, n.cpm]));

  // ── virality (VR) ──
  const vrThresholds = [100_000, 500_000, 1_000_000];
  const viral = vrThresholds.map((t) => liveVideos.filter((v) => v.views >= t).length);
  const viralRate = liveVideos.length ? (viral[0] / liveVideos.length) * 100 : 0;

  // ── insights ──
  const withViews = joined.filter((x) => x.a.totalViews > 0);
  const bestCpm = withViews.map((x) => ({ name: x.c.name, cpm: (x.a.budgetSpent / x.a.totalViews) * 1000 })).sort((a, b) => a.cpm - b.cpm)[0];
  const bestNiche = niches.slice().sort((a, b) => a.cpm - b.cpm)[0];
  const insights: { t: React.ReactNode }[] = [];
  if (cei != null) insights.push({ t: <>Din CPM ligger <b>{Math.abs(cei).toFixed(0)}% {cei >= 0 ? 'under' : 'över'}</b> marknadssnittet ({kr2(marketCpm)}).</> });
  if (bestCpm) insights.push({ t: <><b>{bestCpm.name}</b> levererar din lägsta CPM, {kr2(bestCpm.cpm)} per 1 000 visningar.</> });
  if (vpd.length) { const best = [...vpd].sort((a, b) => b.avgViews - a.avgViews)[0]; insights.push({ t: <>Videos på <b>{best.label}</b> drar flest visningar i snitt ({short(best.avgViews)}).</> }); }
  if (bpt.length) insights.push({ t: <>Bäst att posta på <b>{bpt[0].label.split(' · ')[0].toLowerCase()}</b>, {short(bpt[0].avgViews)} visningar i snitt.</> });
  if (bestNiche && niches.length > 1) insights.push({ t: <>Nischen <b>{bestNiche.cat}</b> är mest kostnadseffektiv, {kr2(bestNiche.cpm)} CPM.</> });

  const hasData = TV > 0;

  return (
    <section className="view active reveal" data-view="analytics">
      <div className="page-head">
        <div>
          <h1 className="page-title">Attention <em>intelligence</em></h1>
          <p className="page-sub">Hur effektivt din spend förvandlas till uppmärksamhet. Räckvidd, engagemang, kostnadseffektivitet och marknadsjämförelse, allt från verklig kampanjdata.</p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>Laddar analys…</div>
      ) : campaigns.length === 0 ? (
        <Empty title="Ingen analys än" sub="Lansera en kampanj så börjar vi mäta visningar, engagemang och CPM i realtid." />
      ) : !hasData ? (
        <Empty title="Väntar på första datan" sub="Dina kampanjer är igång men inga verifierade visningar har kommit in ännu. Analysen fylls i automatiskt så snart kreatörernas content går live." />
      ) : (
        <>
          {/* ── Overview KPIs ── */}
          <div className="vstat-row">
            <Kpi tint="peach" featured label="Totala visningar" val={formatNumber(TV)} sub={`${creators} kreatörer · ${TP} posts`} icon={<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>} />
            <Kpi tint="green" label="Total spend" val={formatCurrency(TS)} sub={`${formatCurrency(remaining)} kvar`} icon={<><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></>} />
            <Kpi tint="lilac" label="CPM" val={kr2(CPM)} sub={cei != null ? `${Math.abs(cei).toFixed(0)}% ${cei >= 0 ? 'under' : 'över'} marknad` : 'kostnad / 1 000 visn.'} icon={<><path d="M5 20V10M12 20V4M19 20v-6" /></>} />
            <Kpi tint="amber" label="Snitt visningar / post" val={short(AVP)} sub={`${formatNumber(views24h)} senaste dygnet`} icon={<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>} />
          </div>
          <div className="an-kpi-grid" style={{ marginBottom: 20 }}>
            <Mini label="Engagemang" val={formatNumber(TE)} hint={`${pct(ER)} ER`} />
            <Mini label="Klick" val={formatNumber(TC)} hint={`${pct(CTR)} CTR`} />
            <Mini label="Kostnad / klick" val={kr2(CPC)} hint="CPC" />
            <Mini label="Attention score" val={String(AES)} hint="VYRLE AES · 0–100" accent />
          </div>

          {/* ── ROI / Attention efficiency ── */}
          <div className="vtop">
            <div className="card vperf">
              <div className="vperf-head"><h3>Attention efficiency score</h3><span className="vchip">VYRLE AES</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
                <Donut size={150} segments={[{ value: AES, color: BLUSH[0] }, { value: 100 - AES, color: 'rgba(0,0,0,0)' }]}>
                  <div className="vrep-num" style={{ fontSize: 40 }}>{AES}</div>
                  <div className="vrep-lbl" style={{ color: 'var(--muted)', fontWeight: 600 }}>av 100</div>
                </Donut>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <MiniBars rows={[
                    { label: 'Engagemang', pct: engScore, value: pct(ER) },
                    { label: 'Delningar', pct: shareScore, value: pct(SHR) },
                    { label: 'Klick', pct: ctrScore, value: pct(CTR) },
                    { label: 'Kostnadseffektivitet', pct: effScore, value: marketCpm ? `${Math.round(effScore)}` : '—' },
                  ]} />
                </div>
              </div>
              <div className="vperf-foot">
                <div className="vf-stat"><div className="vf-l">CPM vs marknad</div><div className="vf-v" style={{ color: cei != null && cei >= 0 ? '#2f9d5b' : 'var(--ink)' }}>{cei != null ? `${cei >= 0 ? '−' : '+'}${Math.abs(cei).toFixed(0)}%` : '—'}</div></div>
                <div className="vf-stat"><div className="vf-l">Marknads-CPM</div><div className="vf-v">{marketCpm ? kr2(marketCpm) : '—'}</div></div>
                <div className="vf-stat"><div className="vf-l">Viral rate</div><div className="vf-v">{pct(viralRate)}</div></div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted-2)', marginTop: 10 }}>Vägt index av engagemang, delningar, klickfrekvens och CPM mot marknaden. Allt från verifierad data.</div>
            </div>

            <div className="card vrep">
              <div className="vperf-head"><h3>Kostnad per …</h3></div>
              <div className="vrep-rows" style={{ marginTop: 0 }}>
                <CostRow label="1 000 visningar (CPM)" value={kr2(CPM)} />
                <CostRow label="Klick (CPC)" value={kr2(CPC)} />
                <CostRow label="Engagemang (CPE)" value={TE ? kr2(CPE) : '—'} />
                <CostRow label="Post (CPP)" value={TP ? kr2(CPP) : '—'} />
                <CostRow label="Delning (CPSH)" value={shares ? kr2(CPSH) : '—'} />
                <CostRow label="Visning" value={`${costPerView.toFixed(3)} kr`} />
                <CostRow label="Sparning (CPS)" value="—" muted note="ej från TikTok ännu" />
              </div>
            </div>
          </div>

          {/* ── Engagement ── */}
          <div className="vcsplit" style={{ marginTop: 18 }}>
            <div className="card">
              <div className="vperf-head"><h3>Engagemang</h3><span className="vchip">{formatNumber(TE)} totalt</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                {(likes + comments + shares) > 0 ? (
                  <Donut size={140} segments={[{ value: likes, color: BLUSH[0] }, { value: comments, color: BLUSH[1] }, { value: shares, color: BLUSH[2] }]}>
                    <div className="vrep-num" style={{ fontSize: 22 }}>{pct(ER)}</div>
                    <div className="vrep-lbl" style={{ color: 'var(--muted)', fontWeight: 600 }}>ER</div>
                  </Donut>
                ) : <div style={{ width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>Inget än</div>}
                <div className="an-legend" style={{ flex: 1, minWidth: 180 }}>
                  <div className="li"><span className="dotc" style={{ background: BLUSH[0] }} />Likes<span className="lv">{formatNumber(likes)}</span></div>
                  <div className="li"><span className="dotc" style={{ background: BLUSH[1] }} />Kommentarer<span className="lv">{formatNumber(comments)}</span></div>
                  <div className="li"><span className="dotc" style={{ background: BLUSH[2] }} />Delningar<span className="lv">{formatNumber(shares)}</span></div>
                  <div className="li"><span className="dotc" style={{ background: 'rgba(183,188,200,.5)' }} />Sparningar<span className="lv">0</span></div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="vperf-head"><h3>Kvalitetssignaler</h3></div>
              <MiniBars rows={[
                { label: 'Engagement rate', pct: clamp(ER * 8), value: pct(ER) },
                { label: 'Share rate', pct: clamp(SHR * 40), value: pct(SHR) },
                { label: 'Klickfrekvens', pct: clamp(CTR * 20), value: pct(CTR) },
              ]} />
              <div style={{ borderTop: '1px solid rgba(241,168,143,.12)', marginTop: 14, paddingTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                <Tile k="Save rate" v="—" note="ej tillgängligt" />
                <Tile k="Save/like" v="—" note="ej tillgängligt" />
                <Tile k="Delning/visn." v={pct(SHR)} />
              </div>
            </div>
          </div>

          {/* ── Views by campaign + budget ── */}
          <div className="vtop" style={{ marginTop: 18 }}>
            <div className="card vperf">
              <div className="vperf-head"><h3>Visningar per kampanj</h3><span className="vchip">{chartRows.length} kampanjer</span></div>
              {chartRows.length >= 2 ? (
                <AreaChart id="brAnViews" values={chartRows.map((x) => x.a.totalViews)} labels={chartRows.map((x) => x.c.name)} fmtY={short} height={260} />
              ) : <div style={{ padding: '50px 10px', textAlign: 'center', color: 'var(--muted)' }}>Kör fler kampanjer så ritas din visningstrend här.</div>}
              <div className="vperf-foot">
                <div className="vf-stat"><div className="vf-l">Total reach</div><div className="vf-v">{formatNumber(TV)}</div></div>
                <div className="vf-stat"><div className="vf-l">Senaste dygnet</div><div className="vf-v">{formatNumber(views24h)}</div></div>
                <div className="vf-stat"><div className="vf-l">Kostnad / visning</div><div className="vf-v">{costPerView.toFixed(3)} kr</div></div>
              </div>
            </div>
            <div className="card vrep">
              <div className="vperf-head"><h3>Budget</h3></div>
              {(TS + remaining) > 0 ? (
                <Donut size={150} segments={[{ value: TS, color: BLUSH[0] }, { value: remaining, color: 'rgba(183,188,200,.4)' }]}>
                  <div className="vrep-num" style={{ fontSize: 26 }}>{Math.round((TS / (TS + remaining)) * 100)}%</div>
                  <div className="vrep-lbl" style={{ color: 'var(--muted)', fontWeight: 600 }}>spenderat</div>
                </Donut>
              ) : <div style={{ width: 150, height: 150, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>Ingen budget</div>}
              <div className="vrep-rows" style={{ marginTop: 'auto' }}>
                <div className="vrep-row"><span className="vrep-ck"><Ck d="m5 12 4 4L19 7" /></span>Spenderat<b>{formatCurrency(TS)}</b></div>
                <div className="vrep-row"><span className="vrep-ck"><Ck d="M12 7v5l3 2" c /></span>Kvar<b>{formatCurrency(remaining)}</b></div>
              </div>
              <Link className="vperf-link" to="/brand/campaigns" style={{ marginTop: 18 }}>Alla kampanjer <Arrow /></Link>
            </div>
          </div>

          {/* ── Top creators ── */}
          <div className="vcsplit" style={{ marginTop: 18 }}>
            <div className="card">
              <div className="vperf-head"><h3>Bästa kreatörer</h3><Link to="/brand/creators" className="view-all">Hitta fler</Link></div>
              {topCreators.length ? topCreators.map((c) => {
                const ccpm = c.views ? (c.payout / c.views) * 1000 : 0;
                const eff = c.payout ? c.views / (c.payout / 1000) : 0; // views per 1000 kr
                return (
                  <div key={c.name} className="vcamp" style={{ cursor: 'default' }}>
                    <span className="vcamp-thumb" style={{ background: grad(c.name) }}><span className="brand-mono">{initial(c.name)}</span></span>
                    <div className="vcamp-main">
                      <div className="vcamp-b">{c.name}</div>
                      <div className="progress-line" style={{ maxWidth: 200, marginTop: 6 }}><span style={{ width: `${Math.round((c.views / maxCreatorViews) * 100)}%` }} /></div>
                    </div>
                    <div className="vcamp-end"><div className="vcamp-k">Views</div><div className="vcamp-v">{formatNumber(c.views)}</div></div>
                    <div className="vcamp-end"><div className="vcamp-k">Kostnad/1K</div><div className="vcamp-v">{ccpm ? kr2(ccpm) : '—'}</div></div>
                    <div className="vcamp-end"><div className="vcamp-k">Visn/1000kr</div><div className="vcamp-v">{eff ? short(eff) : '—'}</div></div>
                  </div>
                );
              }) : <Muted>Inga kreatörer med data än.</Muted>}
            </div>
            <div className="card">
              <div className="vperf-head"><h3>Per nisch vs marknad</h3></div>
              {niches.length ? niches.slice(0, 6).map((n) => {
                const mk = marketCat.get(n.cat);
                const diff = mk && n.cpm ? (1 - n.cpm / mk) * 100 : null;
                return (
                  <div key={n.cat} className="list-row">
                    <div className="row-main" style={{ flex: 1 }}>
                      <div className="t">{n.cat}</div>
                      <div className="s">{formatNumber(n.views)} views · ER {pct(n.er)}</div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 80 }}><div className="t">{kr2(n.cpm)}</div><div className="s">CPM</div></div>
                    <div style={{ textAlign: 'right', minWidth: 76 }}>{diff != null ? <span className={`badge ${diff >= 0 ? 'green' : 'red'}`}>{diff >= 0 ? '−' : '+'}{Math.abs(diff).toFixed(0)}%</span> : <span className="s">—</span>}</div>
                  </div>
                );
              }) : <Muted>Ingen nisch-data än.</Muted>}
            </div>
          </div>

          {/* ── Top content ── */}
          {topContent.length > 0 && (
            <div className="card" style={{ marginTop: 18 }}>
              <div className="vperf-head"><h3>Bäst presterande content</h3><span className="vchip">{liveVideos.length} posts</span></div>
              {topContent.map((v, i) => (
                <div key={i} className="list-row">
                  <span className="mono sq" style={{ background: grad(v.creator) }}>{initial(v.creator)}</span>
                  <div className="row-main" style={{ flex: 1 }}>
                    <div className="t">{v.creator}{v.durationSeconds ? ` · ${v.durationSeconds}s` : ''}</div>
                    <a href={v.videoUrl} target="_blank" rel="noopener noreferrer" className="s" style={{ color: '#C26A4A' }}>Visa video</a>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 76 }}><div className="t">{formatNumber(v.views)}</div><div className="s">views</div></div>
                  <div style={{ textAlign: 'right', minWidth: 64 }}><div className="t">{formatNumber(v.likes + v.comments + v.shares)}</div><div className="s">eng.</div></div>
                  <div style={{ textAlign: 'right', minWidth: 56 }}><div className="t">{formatNumber(v.clicks)}</div><div className="s">klick</div></div>
                </div>
              ))}
            </div>
          )}

          {/* ── Duration + Posting times ── */}
          <div className="vcsplit" style={{ marginTop: 18 }}>
            <div className="card">
              <div className="vperf-head"><h3>Prestanda per videolängd</h3></div>
              {vpd.length ? (
                <>
                  <MiniBars rows={vpd.map((b) => ({ label: b.label, pct: (b.avgViews / maxVpd) * 100, value: short(b.avgViews) }))} />
                  <div style={{ borderTop: '1px solid rgba(241,168,143,.12)', marginTop: 14, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {vpd.map((b) => <div key={b.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{b.label}</span><span style={{ color: 'var(--muted)' }}>{b.count} posts · ER {pct(b.er)}</span></div>)}
                  </div>
                </>
              ) : <Muted>Videolängd registreras när posts synkas från TikTok.</Muted>}
            </div>
            <div className="card">
              <div className="vperf-head"><h3>Bästa publiceringstid</h3></div>
              {bpt.length ? <MiniBars rows={bpt.map((b) => ({ label: b.label, pct: (b.avgViews / maxBpt) * 100, value: short(b.avgViews) }))} /> : <Muted>Publiceringstid registreras när posts synkas från TikTok.</Muted>}
            </div>
          </div>

          {/* ── Hashtags + Virality ── */}
          <div className="vcsplit" style={{ marginTop: 18 }}>
            <div className="card">
              <div className="vperf-head"><h3>Topp-hashtags</h3></div>
              {topTags.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {topTags.map((t) => (
                    <div key={t.tag} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 13px', borderRadius: 980, border: '1px solid rgba(241,168,143,.2)', background: 'rgba(255,255,255,.6)', fontSize: 12.5 }}>
                      <span style={{ fontWeight: 600, color: '#C26A4A' }}>#{t.tag}</span>
                      <span style={{ color: 'var(--muted)' }}>{short(t.views)} · {t.count}×</span>
                    </div>
                  ))}
                </div>
              ) : <Muted>Hashtags läses ur posternas captions vid synk.</Muted>}
            </div>
            <div className="card">
              <div className="vperf-head"><h3>Viralitet</h3></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 12 }}>
                {['100K+', '500K+', '1M+'].map((lab, i) => (
                  <div key={lab} style={{ textAlign: 'center', padding: '14px 8px', borderRadius: 14, background: 'linear-gradient(140deg,rgba(255,227,211,.5),rgba(237,225,255,.35))' }}>
                    <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--ink)' }}>{viral[i]}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>videos {lab}</div>
                  </div>
                ))}
              </div>
              <div className="vrep-rows" style={{ marginTop: 0 }}>
                <CostRow label="Viral rate (100K+)" value={pct(viralRate)} />
                <CostRow label="Visningar senaste dygnet" value={formatNumber(views24h)} />
              </div>
            </div>
          </div>

          {/* ── Insights ── */}
          {insights.length > 0 && (
            <div className="card" style={{ marginTop: 18 }}>
              <div className="vperf-head"><h3>Insikter</h3><span style={{ fontSize: 12.5, color: 'var(--muted)' }}>härlett ur din data</span></div>
              {insights.map((ins, i) => (
                <div key={i} className="an-insight">
                  <span className="ai-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0-6 6c0 2 1 3 2 4l.5 2h7l.5-2c1-1 2-2 2-4a6 6 0 0 0-6-6zM9 21h6" /></svg></span>
                  <div className="ai-t">{ins.t}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--muted-2)', textAlign: 'center', lineHeight: 1.5 }}>
            Allt bygger på verifierad visnings, klick, engagemang och spend-data. Sparningar (saves) exponeras inte av TikTok ännu och visas därför som 0. Marknads-CPM räknas över alla kampanjer på plattformen.
          </div>
        </>
      )}
    </section>
  );
}

function sum<T>(arr: T[], f: (x: T) => number) { return arr.reduce((s, x) => s + (f(x) || 0), 0); }

function Kpi({ tint, label, val, sub, icon, featured }: { tint: 'peach' | 'lilac' | 'green' | 'amber'; label: string; val: string; sub: string; icon: React.ReactNode; featured?: boolean }) {
  const ic = { peach: 'linear-gradient(140deg,#FFE3D3,#FFC2A6)', lilac: 'linear-gradient(140deg,#EDE1FF,#cdb8f2)', green: 'linear-gradient(140deg,#d7f0e0,#a9dcc0)', amber: 'linear-gradient(140deg,#FFE9D2,#F2C58A)' };
  const col = { peach: '#9c4f31', lilac: '#6a4ea8', green: '#2f7d52', amber: '#9c6b1c' };
  return (
    <div className="card vstat" style={featured ? { background: 'linear-gradient(160deg,#fff,#FFF6F0)' } : undefined}>
      <div className="vstat-ico" style={{ background: ic[tint], color: col[tint] }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{icon}</svg></div>
      <div className="vstat-lbl">{label}</div>
      <div className="vstat-val">{val}</div>
      <div className="vstat-sub"><span className="vmut">{sub}</span></div>
    </div>
  );
}

function Mini({ label, val, hint, accent }: { label: string; val: string; hint: string; accent?: boolean }) {
  return (
    <div className="card" style={{ padding: '18px 20px', ...(accent ? { background: 'linear-gradient(160deg,#fff,#FFF6F0)' } : {}) }}>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-.03em', color: 'var(--ink)', margin: '4px 0 2px', ...(accent ? { background: 'linear-gradient(120deg,#C26A4A,#F1A88F)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : {}) }}>{val}</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted-2)' }}>{hint}</div>
    </div>
  );
}

function CostRow({ label, value, muted, note }: { label: string; value: string; muted?: boolean; note?: string }) {
  return (
    <div className="vrep-row" style={{ fontSize: 13 }}>
      {label}{note && <span style={{ fontSize: 10.5, color: 'var(--muted-2)', marginLeft: 7 }}>{note}</span>}
      <b style={{ color: muted ? 'var(--muted-2)' : 'var(--ink)' }}>{value}</b>
    </div>
  );
}

function Tile({ k, v, note }: { k: string; v: string; note?: string }) {
  return <div><div className="vcamp-k">{k}</div><div className="vcamp-v" style={{ fontSize: 16 }}>{v}</div>{note && <div style={{ fontSize: 10, color: 'var(--muted-2)' }}>{note}</div>}</div>;
}

function Ck({ d, c }: { d: string; c?: boolean }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{c && <circle cx="12" cy="12" r="9" />}<path d={d} /></svg>;
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '30px 6px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>{children}</div>;
}

function Empty({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '54px 24px' }}>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
      <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8, maxWidth: 440, marginInline: 'auto' }}>{sub}</div>
      <Link to="/brand/campaigns/new" className="btn-apply" style={{ width: 'auto', display: 'inline-block', padding: '11px 22px', marginTop: 18 }}>Skapa kampanj</Link>
    </div>
  );
}

function Arrow() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}
