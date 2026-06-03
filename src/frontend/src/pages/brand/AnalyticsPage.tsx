import { Link } from 'react-router-dom';
import { useBrandAnalytics } from '@/hooks/api';
import { AreaChart, Donut, MiniBars, BLUSH } from '@/components/vyrle/Viz';
import { formatNumber, formatCurrency } from '@/lib/utils';
import type { CampaignAnalytics, CreatorPerformance, CreatorVideo } from '@/types';

const GRADS = ['linear-gradient(135deg,#FFD8C7,#F1A88F)', 'linear-gradient(135deg,#cdb8f2,#9c7de0)', 'linear-gradient(135deg,#F2C58A,#e0a04e)', 'linear-gradient(135deg,#a9dcc0,#5fb98a)'];
const grad = (s: string) => GRADS[((s || '').charCodeAt(0) || 0) % GRADS.length];
const initial = (s: string) => (s?.[0] || '?').toUpperCase();
const kr2 = (n: number) => `${n.toFixed(2)} kr`;
const short = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace('.0', '') + 'K' : String(Math.round(n)));

export function BrandAnalyticsPage() {
  const { campaigns, analytics, isLoading } = useBrandAnalytics();

  // join analytics -> campaign list item
  const byId = new Map(campaigns.map((c) => [c.id, c]));
  const joined = analytics.map((a) => ({ a, c: byId.get(a.campaignId) })).filter((x) => x.c) as { a: CampaignAnalytics; c: typeof campaigns[number] }[];

  // ── core metrics ──
  const TV = analytics.reduce((s, a) => s + (a.totalViews || 0), 0);
  const TS = analytics.reduce((s, a) => s + (a.budgetSpent || 0), 0);
  const TC = analytics.reduce((s, a) => s + (a.totalClicks || 0), 0);
  const remaining = analytics.reduce((s, a) => s + (a.budgetRemaining || 0), 0);
  const TP = analytics.reduce((s, a) => s + a.creatorPerformance.reduce((p, cp) => p + (cp.videos?.length || 0), 0), 0);
  const CPM = TV ? (TS / TV) * 1000 : 0;
  const CPC = TC ? TS / TC : 0;
  const CTR = TV ? (TC / TV) * 100 : 0;
  const costPerView = TV ? TS / TV : 0;
  const AVP = TP ? TV / TP : 0;
  const creators = analytics.reduce((s, a) => s + a.totalCreators, 0);

  // ── views by campaign chart ──
  const chartRows = [...joined].filter((x) => x.a.totalViews > 0).sort((x, y) => x.a.totalViews - y.a.totalViews).slice(-10);
  const chartVals = chartRows.map((x) => x.a.totalViews);
  const chartLabels = chartRows.map((x) => x.c.name);

  // ── top creators (merge across campaigns) ──
  const creatorMap = new Map<string, { name: string; views: number; clicks: number; payout: number }>();
  analytics.forEach((a) => a.creatorPerformance.forEach((cp: CreatorPerformance) => {
    const e = creatorMap.get(cp.creatorId) ?? { name: cp.displayName, views: 0, clicks: 0, payout: 0 };
    e.views += cp.views || 0; e.clicks += cp.clicks || 0; e.payout += cp.payoutAmount || 0;
    creatorMap.set(cp.creatorId, e);
  }));
  const topCreators = [...creatorMap.values()].sort((a, b) => b.views - a.views).slice(0, 5);
  const maxCreatorViews = Math.max(1, ...topCreators.map((c) => c.views));

  // ── top content (videos) ──
  const allVideos: { url: string; views: number; clicks: number; creator: string }[] = [];
  analytics.forEach((a) => a.creatorPerformance.forEach((cp) => (cp.videos || []).forEach((v: CreatorVideo) => allVideos.push({ url: v.videoUrl, views: v.views || 0, clicks: v.clicks || 0, creator: cp.displayName }))));
  const topContent = allVideos.sort((a, b) => b.views - a.views).slice(0, 5);

  // ── niche / category performance ──
  const nicheMap = new Map<string, { views: number; spend: number; clicks: number }>();
  joined.forEach(({ a, c }) => {
    const e = nicheMap.get(c.category) ?? { views: 0, spend: 0, clicks: 0 };
    e.views += a.totalViews || 0; e.spend += a.budgetSpent || 0; e.clicks += a.totalClicks || 0;
    nicheMap.set(c.category, e);
  });
  const niches = [...nicheMap.entries()].map(([cat, v]) => ({ cat, ...v, cpm: v.views ? (v.spend / v.views) * 1000 : 0, ctr: v.views ? (v.clicks / v.views) * 100 : 0 })).sort((a, b) => b.views - a.views);
  const maxNiche = Math.max(1, ...niches.map((n) => n.views));

  // ── honest derived insights ──
  const withViews = joined.filter((x) => x.a.totalViews > 0);
  const bestCpm = withViews.map((x) => ({ name: x.c.name, cpm: (x.a.budgetSpent / x.a.totalViews) * 1000 })).sort((a, b) => a.cpm - b.cpm)[0];
  const bestNiche = niches.filter((n) => n.views > 0).sort((a, b) => a.cpm - b.cpm)[0];
  const topCreator = topCreators[0];
  const insights: { t: React.ReactNode }[] = [];
  if (bestCpm) insights.push({ t: <><b>{bestCpm.name}</b> levererar din lägsta CPM, {kr2(bestCpm.cpm)} per 1 000 visningar.</> });
  if (bestNiche) insights.push({ t: <>Nischen <b>{bestNiche.cat}</b> är mest kostnadseffektiv just nu, {kr2(bestNiche.cpm)} CPM.</> });
  if (topCreator && topCreator.views > 0) insights.push({ t: <><b>{topCreator.name}</b> driver flest visningar, {formatNumber(topCreator.views)} totalt.</> });
  if (CTR > 0) insights.push({ t: <>Din genomsnittliga klickfrekvens ligger på <b>{CTR.toFixed(2)}%</b> ({formatNumber(TC)} klick).</> });

  const hasData = TV > 0;

  return (
    <section className="view active reveal" data-view="analytics">
      <div className="page-head">
        <div>
          <h1 className="page-title">Attention <em>intelligence</em></h1>
          <p className="page-sub">Hur effektivt din spend förvandlas till uppmärksamhet. Visningar, kostnad och vilka kreatörer och kampanjer som presterar bäst, allt från verklig kampanjdata.</p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>Laddar analys…</div>
      ) : campaigns.length === 0 ? (
        <Empty title="Ingen analys än" sub="Lansera en kampanj så börjar vi mäta visningar, CPM och kreatörsprestanda i realtid." />
      ) : !hasData ? (
        <Empty title="Väntar på första datan" sub="Dina kampanjer är igång men inga verifierade visningar har kommit in ännu. Analysen fylls i automatiskt så snart kreatörernas content går live." />
      ) : (
        <>
          {/* ── Overview KPIs ── */}
          <div className="vstat-row">
            <Kpi tint="peach" featured label="Totala visningar" val={formatNumber(TV)} sub={`${creators} kreatörer · ${TP} posts`} icon={<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>} />
            <Kpi tint="green" label="Total spend" val={formatCurrency(TS)} sub={`${formatCurrency(remaining)} kvar i budget`} icon={<><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></>} />
            <Kpi tint="lilac" label="CPM" val={kr2(CPM)} sub="kostnad / 1 000 visningar" icon={<><path d="M5 20V10M12 20V4M19 20v-6" /></>} />
            <Kpi tint="amber" label="Snitt visningar / post" val={short(AVP)} sub={`${formatNumber(TP)} posts totalt`} icon={<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>} />
          </div>

          {/* ── chart + budget ── */}
          <div className="vtop">
            <div className="card vperf">
              <div className="vperf-head"><h3>Visningar per kampanj</h3><span className="vchip">{chartRows.length} kampanjer</span></div>
              {chartVals.length >= 2 ? (
                <AreaChart id="brAnViews" values={chartVals} labels={chartLabels} fmtY={short} height={280} />
              ) : (
                <div style={{ padding: '50px 10px', textAlign: 'center', color: 'var(--muted)' }}>Kör fler kampanjer så ritas din visningstrend här.</div>
              )}
              <div className="vperf-foot">
                <div className="vf-stat"><div className="vf-l">Total reach</div><div className="vf-v">{formatNumber(TV)}</div></div>
                <div className="vf-stat"><div className="vf-l">Klickfrekvens</div><div className="vf-v">{CTR.toFixed(2)}%</div></div>
                <div className="vf-stat"><div className="vf-l">Kostnad / klick</div><div className="vf-v">{kr2(CPC)}</div></div>
                <div className="vf-stat"><div className="vf-l">Kostnad / visning</div><div className="vf-v">{costPerView.toFixed(3)} kr</div></div>
              </div>
            </div>

            <div className="card vrep">
              <div className="vperf-head"><h3>Budget</h3></div>
              {(TS + remaining) > 0 ? (
                <Donut size={160} segments={[{ value: TS, color: BLUSH[0] }, { value: remaining, color: 'rgba(183,188,200,.4)' }]}>
                  <div className="vrep-num" style={{ fontSize: 26 }}>{Math.round((TS / (TS + remaining)) * 100)}%</div>
                  <div className="vrep-lbl" style={{ color: 'var(--muted)', fontWeight: 600 }}>spenderat</div>
                </Donut>
              ) : <div style={{ width: 160, height: 160, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>Ingen budget</div>}
              <div className="vrep-rows" style={{ marginTop: 'auto' }}>
                <div className="vrep-row"><span className="vrep-ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 7" /></svg></span>Spenderat<b>{formatCurrency(TS)}</b></div>
                <div className="vrep-row"><span className="vrep-ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></span>Kvar<b>{formatCurrency(remaining)}</b></div>
                <div className="vrep-row"><span className="vrep-ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 20V10M12 20V4M19 20v-6" /></svg></span>CPM<b>{kr2(CPM)}</b></div>
              </div>
              <Link className="vperf-link" to="/brand/campaigns" style={{ marginTop: 18 }}>Alla kampanjer <Arrow /></Link>
            </div>
          </div>

          {/* ── top creators + niche ── */}
          <div className="vcsplit" style={{ marginTop: 18 }}>
            <div className="card">
              <div className="vperf-head"><h3>Bästa kreatörer</h3><Link to="/brand/creators" className="view-all">Hitta fler</Link></div>
              {topCreators.length ? topCreators.map((c) => {
                const ccpm = c.views ? (c.payout / c.views) * 1000 : 0;
                return (
                  <div key={c.name} className="vcamp" style={{ cursor: 'default' }}>
                    <span className="vcamp-thumb" style={{ background: grad(c.name) }}><span className="brand-mono">{initial(c.name)}</span></span>
                    <div className="vcamp-main">
                      <div className="vcamp-b">{c.name}</div>
                      <div className="progress-line" style={{ maxWidth: 220, marginTop: 6 }}><span style={{ width: `${Math.round((c.views / maxCreatorViews) * 100)}%` }} /></div>
                    </div>
                    <div className="vcamp-end"><div className="vcamp-k">Views</div><div className="vcamp-v">{formatNumber(c.views)}</div></div>
                    <div className="vcamp-end"><div className="vcamp-k">CPM</div><div className="vcamp-v">{ccpm ? kr2(ccpm) : '—'}</div></div>
                  </div>
                );
              }) : <div style={{ padding: '30px 6px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Inga kreatörer med data än.</div>}
            </div>

            <div className="card">
              <div className="vperf-head"><h3>Per nisch</h3></div>
              {niches.length ? (
                <>
                  <MiniBars rows={niches.slice(0, 5).map((n) => ({ label: n.cat, pct: (n.views / maxNiche) * 100, value: formatNumber(n.views) }))} />
                  <div style={{ borderTop: '1px solid rgba(241,168,143,.12)', marginTop: 14, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {niches.slice(0, 3).map((n) => (
                      <div key={n.cat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5 }}>
                        <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{n.cat}</span>
                        <span style={{ color: 'var(--muted)' }}>CPM {kr2(n.cpm)} · CTR {n.ctr.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <div style={{ padding: '30px 6px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Ingen nisch-data än.</div>}
            </div>
          </div>

          {/* ── top content ── */}
          {topContent.length > 0 && (
            <div className="card" style={{ marginTop: 18 }}>
              <div className="vperf-head"><h3>Bäst presterande content</h3><span className="vchip">{allVideos.length} posts</span></div>
              {topContent.map((v, i) => (
                <div key={i} className="list-row">
                  <span className="mono sq" style={{ background: grad(v.creator) }}>{initial(v.creator)}</span>
                  <div className="row-main" style={{ flex: 1 }}>
                    <div className="t">{v.creator}</div>
                    <a href={v.url} target="_blank" rel="noopener noreferrer" className="s" style={{ color: '#C26A4A' }}>Visa video</a>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 86 }}><div className="t">{formatNumber(v.views)}</div><div className="s">views</div></div>
                  <div style={{ textAlign: 'right', minWidth: 70 }}><div className="t">{formatNumber(v.clicks)}</div><div className="s">klick</div></div>
                </div>
              ))}
            </div>
          )}

          {/* ── insights ── */}
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

          {/* honest roadmap note */}
          <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--muted-2)', textAlign: 'center', lineHeight: 1.5 }}>
            Engagemangsmått (likes, delningar, sparningar) och market CPM-jämförelser kommer när TikTok-synken kopplas till kampanjanalysen. Allt ovan bygger på verifierad visnings, klick och spend-data.
          </div>
        </>
      )}
    </section>
  );
}

function Kpi({ tint, label, val, sub, icon, featured }: { tint: 'peach' | 'lilac' | 'green' | 'amber'; label: string; val: string; sub: string; icon: React.ReactNode; featured?: boolean }) {
  const ic = { peach: 'linear-gradient(140deg,#FFE3D3,#FFC2A6)', lilac: 'linear-gradient(140deg,#EDE1FF,#cdb8f2)', green: 'linear-gradient(140deg,#d7f0e0,#a9dcc0)', amber: 'linear-gradient(140deg,#FFE9D2,#F2C58A)' };
  const col = { peach: '#9c4f31', lilac: '#6a4ea8', green: '#2f7d52', amber: '#9c6b1c' };
  return (
    <div className="card vstat" style={featured ? { background: 'linear-gradient(160deg,#fff,#FFF6F0)' } : undefined}>
      <div className="vstat-ico" style={{ background: ic[tint], color: col[tint] }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
      </div>
      <div className="vstat-lbl">{label}</div>
      <div className="vstat-val">{val}</div>
      <div className="vstat-sub"><span className="vmut">{sub}</span></div>
    </div>
  );
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
