import { Link } from 'react-router-dom';
import { useCreatorAssignments, useCreatorProfile, useCreatorPayouts } from '@/hooks/api';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { AreaChart, Donut, MiniBars, VizDefs, BLUSH } from '@/components/vyrle/Viz';

const GRADS = [
  'linear-gradient(135deg,#FFD8C7,#F1A88F)',
  'linear-gradient(135deg,#cdb8f2,#9c7de0)',
  'linear-gradient(135deg,#F2C58A,#e0a04e)',
  'linear-gradient(135deg,#a9dcc0,#5fb98a)',
];
const grad = (s: string) => GRADS[((s || '').charCodeAt(0) || 0) % GRADS.length];
const initial = (s: string) => (s?.[0] || '?').toUpperCase();

function Arrow() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

/* ───────────────────────── Analytics ───────────────────────── */
function shortMoney(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace('.0', '') + 'K';
  return String(Math.round(n));
}

export function CreatorAnalyticsPage() {
  const { data: res, isLoading } = useCreatorAssignments();
  const { data: profile } = useCreatorProfile();
  const assignments = res?.data ?? [];

  const totalViews = assignments.reduce((s, a) => s + (a.totalVerifiedViews || 0), 0);
  const totalClicks = assignments.reduce((s, a) => s + (a.totalTrackedClicks || 0), 0);
  const totalEarned = assignments.reduce((s, a) => s + (a.currentPayoutAmount || 0), 0);
  const ctr = totalViews ? (totalClicks / totalViews) * 100 : 0;
  const live = assignments.filter((a) => ['Active', 'InProgress', 'Submitted', 'Approved'].includes(a.status)).length;
  const earningPerView = totalViews ? (totalEarned / totalViews) * 1000 : 0; // per 1k views
  const avgViews = assignments.length ? totalViews / assignments.length : 0;

  const ranked = [...assignments].sort((a, b) => (b.totalVerifiedViews || 0) - (a.totalVerifiedViews || 0));
  const maxViews = Math.max(1, ...ranked.map((a) => a.totalVerifiedViews || 0));

  // earnings split by campaign (real)
  const earners = ranked.filter((a) => (a.currentPayoutAmount || 0) > 0).sort((a, b) => b.currentPayoutAmount - a.currentPayoutAmount);
  const earnSegments = earners.slice(0, 8).map((a, i) => ({ value: a.currentPayoutAmount, color: BLUSH[i % BLUSH.length] }));

  // views-by-campaign chart series (oldest → newest by assignedAt so it reads as a trend)
  const byTime = [...assignments].sort((a, b) => +new Date(a.assignedAt) - +new Date(b.assignedAt)).slice(-10);
  const chartVals = byTime.map((a) => a.totalVerifiedViews || 0);
  const chartLabels = byTime.map((a) => a.campaignName);

  return (
    <section className="view active reveal" data-view="analytics">
      <VizDefs />
      <div className="page-head">
        <div>
          <h1 className="page-title">Know your <em>numbers</em></h1>
          <p className="page-sub">A clear read on reach, performance and what actually pays. Every figure is your verified, attributed performance — no estimates.</p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
      ) : assignments.length === 0 ? (
        <EmptyCard title="No analytics yet" sub="Once you join a campaign and your videos go live, your verified performance shows up here — reach, clicks and earnings, all in one place." cta="Discover campaigns" to="/creator/browse" />
      ) : (
        <>
          <div className="vstat-row">
            <BigStat label="Verified views" val={formatNumber(totalViews)} hint={`across ${assignments.length} campaign${assignments.length === 1 ? '' : 's'}`} tint="peach" featured />
            <BigStat label="Tracked clicks" val={formatNumber(totalClicks)} hint={`${ctr.toFixed(2)}% click-through`} tint="lilac" />
            <BigStat label="Earnings" val={formatCurrency(totalEarned)} hint={`${formatCurrency(earningPerView)} / 1K views`} tint="green" money />
            <BigStat label="Live campaigns" val={String(live)} hint={`${formatNumber(Math.round(avgViews))} avg views`} tint="amber" />
          </div>

          <div className="vtop">
            <div className="card vperf">
              <div className="vperf-head"><h3>Views by campaign</h3><span className="vchip">{byTime.length} most recent</span></div>
              {chartVals.length >= 2 ? (
                <AreaChart id="anViews" values={chartVals} labels={chartLabels} fmtY={shortMoney} height={280} />
              ) : (
                <div style={{ padding: '50px 10px', textAlign: 'center', color: 'var(--muted)' }}>Run a couple of campaigns and your view trend draws itself here.</div>
              )}
              <div className="vperf-foot">
                <div className="vf-stat"><div className="vf-l">Total reach</div><div className="vf-v">{formatNumber(totalViews)}</div></div>
                <div className="vf-stat"><div className="vf-l">Best campaign</div><div className="vf-v">{ranked[0] ? formatNumber(ranked[0].totalVerifiedViews) : '—'}</div></div>
                <div className="vf-stat"><div className="vf-l">Click-through</div><div className="vf-v">{ctr.toFixed(2)}%</div></div>
                <Link className="vperf-link" to="/creator/assignments" style={{ margin: 0 }}>My campaigns <Arrow /></Link>
              </div>
            </div>

            <div className="card vrep">
              <div className="vperf-head"><h3>Where you earn</h3></div>
              {earnSegments.length ? (
                <>
                  <Donut size={170} segments={earnSegments}>
                    <div className="vrep-num" style={{ fontSize: 30 }}>{formatCurrency(totalEarned)}</div>
                    <div className="vrep-lbl" style={{ color: 'var(--muted)', fontWeight: 600 }}>total earned</div>
                  </Donut>
                  <div className="an-legend" style={{ marginTop: 'auto' }}>
                    {earners.slice(0, 4).map((a, i) => (
                      <div className="li" key={a.id}><span className="dotc" style={{ background: BLUSH[i % BLUSH.length] }} />{a.campaignName}<span className="lv">{formatCurrency(a.currentPayoutAmount)}</span></div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ padding: '40px 10px', textAlign: 'center', color: 'var(--muted)' }}>No earnings tracked yet. Once a campaign pays out, the split shows here.</div>
              )}
              <Link className="vperf-link" to="/creator/earnings" style={{ marginTop: 18 }}>Open earnings <Arrow /></Link>
            </div>
          </div>

          <div className="vcsplit" style={{ marginTop: 18 }}>
            <div className="card">
              <div className="vperf-head"><h3>Top performing content</h3></div>
              {ranked.slice(0, 5).map((a) => (
                <div key={a.id} className="vcamp" style={{ cursor: 'default' }}>
                  <span className="vcamp-thumb" style={{ background: grad(a.campaignName) }}><span className="brand-mono">{initial(a.campaignName)}</span></span>
                  <div className="vcamp-main">
                    <div className="vcamp-b">{a.campaignName}</div>
                    <div className="progress-line" style={{ maxWidth: 260, marginTop: 6 }}><span style={{ width: `${Math.round(((a.totalVerifiedViews || 0) / maxViews) * 100)}%` }} /></div>
                  </div>
                  <div className="vcamp-end"><div className="vcamp-k">Views</div><div className="vcamp-v">{formatNumber(a.totalVerifiedViews || 0)}</div></div>
                  <div className="vcamp-end"><div className="vcamp-k">Clicks</div><div className="vcamp-v">{formatNumber(a.totalTrackedClicks || 0)}</div></div>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="vperf-head"><h3>Reach &amp; monetization</h3></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--muted)', marginBottom: 6 }}><span>Audience</span><span>{formatNumber(profile?.followerCount ?? 0)} followers</span></div>
                  <MiniBars rows={[
                    { label: 'Click-through', pct: Math.min(100, ctr * 8), value: ctr.toFixed(2) + '%' },
                    { label: 'Earn / 1K views', pct: Math.min(100, earningPerView * 2), value: formatCurrency(earningPerView) },
                    { label: 'Avg views', pct: Math.min(100, (avgViews / maxViews) * 100), value: shortMoney(avgViews) },
                  ]} />
                </div>
                <div style={{ borderTop: '1px solid rgba(241,168,143,.12)', paddingTop: 14, display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
                  <div><div className="vcamp-k">Total clicks</div><div className="vcamp-v" style={{ fontSize: 18 }}>{formatNumber(totalClicks)}</div></div>
                  <div><div className="vcamp-k">Campaigns run</div><div className="vcamp-v" style={{ fontSize: 18 }}>{assignments.length}</div></div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function BigStat({ label, val, hint, tint, featured, money }: { label: string; val: string; hint?: string; tint: 'peach' | 'lilac' | 'green' | 'amber'; featured?: boolean; money?: boolean }) {
  const ic: Record<string, string> = {
    peach: 'linear-gradient(140deg,#FFE3D3,#FFC2A6)', lilac: 'linear-gradient(140deg,#EDE1FF,#cdb8f2)', green: 'linear-gradient(140deg,#d7f0e0,#a9dcc0)', amber: 'linear-gradient(140deg,#FFE9D2,#F2C58A)',
  };
  const col: Record<string, string> = { peach: '#9c4f31', lilac: '#6a4ea8', green: '#2f7d52', amber: '#9c6b1c' };
  return (
    <div className="card vstat">
      <div className="vstat-ico" style={{ background: ic[tint], color: col[tint] }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 20V10M12 20V4M19 20v-6" /></svg>
      </div>
      <div className="vstat-lbl">{label}</div>
      <div className="vstat-val" style={featured || money ? undefined : undefined}>{val}</div>
      {hint && <div className="vstat-sub"><span className="vmut">{hint}</span></div>}
    </div>
  );
}

/* ───────────────────────── Link Tree ───────────────────────── */
export function CreatorLinksPage() {
  const { data: profile } = useCreatorProfile();
  const { data: res } = useCreatorAssignments();
  const assignments = res?.data ?? [];
  const live = assignments.filter((a) => ['Active', 'InProgress', 'Submitted', 'Approved', 'Completed'].includes(a.status));
  const name = profile?.displayName || 'Creator';
  const handle = profile?.tikTokUsername ? '@' + profile.tikTokUsername : '';

  return (
    <section className="view active reveal" data-view="links">
      <div className="page-head">
        <div>
          <h1 className="page-title">Link <em>Tree</em></h1>
          <p className="page-sub">Every campaign you are running gets a tracked link. Clicks shown here are the real, attributed clicks that count toward your click based payouts.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 20, alignItems: 'start' }}>
        <div className="card">
          <div className="sec-head"><h3>Your campaign links</h3><span style={{ fontSize: 13, color: 'var(--muted)' }}>{live.length} active</span></div>
          {live.length === 0 ? (
            <div style={{ padding: '34px 6px', textAlign: 'center' }}>
              <div style={{ fontWeight: 600 }}>No live links yet</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>Join a campaign and your tracked link appears here automatically.</div>
              <Link to="/creator/browse" className="btn-apply" style={{ width: 'auto', display: 'inline-block', padding: '11px 20px', marginTop: 16 }}>Discover campaigns</Link>
            </div>
          ) : live.map((a) => (
            <Link key={a.id} to={`/creator/assignments/${a.id}`} className="lt-link" style={{ textDecoration: 'none' }}>
              <span className="lt-grip"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="18" r="1" /></svg></span>
              <span className="lt-ic" style={{ background: grad(a.campaignName) }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 17H7a5 5 0 0 1 0-10h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8" /></svg></span>
              <div className="lt-main"><div className="lt-t">{a.campaignName}</div><div className="lt-u">{a.status} · tracked link</div></div>
              <div className="lt-clicks"><div className="n">{formatNumber(a.totalTrackedClicks || 0)}</div><div className="l">clicks</div></div>
            </Link>
          ))}
        </div>

        <div className="lt-phone">
          <div className="lt-screen">
            <div className="pp">{initial(name)}</div>
            <div className="pn">{name}</div>
            <div className="pb">{handle}</div>
            {live.slice(0, 5).map((a) => <span key={a.id} className="lt-pill">{a.campaignName}</span>)}
            {live.length === 0 && <span className="lt-pill" style={{ opacity: .6 }}>Your links preview here</span>}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Creator Levels ───────────────────────── */
const TIERS = [
  { name: 'Rising', min: 0 },
  { name: 'Established', min: 5000 },
  { name: 'Pro', min: 25000 },
  { name: 'Elite', min: 100000 },
  { name: 'Icon', min: 500000 },
];

export function CreatorLevelsPage() {
  const { data: profile } = useCreatorProfile();
  const { data: payRes } = useCreatorPayouts();
  const { data: asgRes } = useCreatorAssignments();
  const payouts = payRes?.data ?? [];
  const assignments = asgRes?.data ?? [];

  const lifetimeEarned = payouts.filter((p) => p.status === 'Paid').reduce((s, p) => s + p.amount, 0);
  const completed = assignments.filter((a) => a.status === 'Completed').length;

  let idx = 0;
  for (let i = 0; i < TIERS.length; i++) if (lifetimeEarned >= TIERS[i].min) idx = i;
  const cur = TIERS[idx];
  const next = TIERS[idx + 1];
  const pct = next ? Math.min(100, Math.round(((lifetimeEarned - cur.min) / (next.min - cur.min)) * 100)) : 100;
  const name = profile?.displayName || 'Creator';

  return (
    <section className="view active reveal" data-view="levels">
      <div className="page-head">
        <div>
          <h1 className="page-title">Creator <em>Levels</em></h1>
          <p className="page-sub">Your level is earned from real, paid out earnings on the platform. Keep delivering campaigns to climb the ladder and unlock perks.</p>
        </div>
      </div>

      <div className="lvl-hero" style={{ background: 'linear-gradient(135deg,#1A2230,#0B0F17)' }}>
        <div className="lvl-hero-row">
          <div className="lvl-badge-big">
            <svg viewBox="0 0 24 24" fill="none" stroke="#3a1d12" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="9" r="4" /><path d="M9 13l-1.5 8 4.5-2.5 4.5 2.5L15 13" /></svg>
            <span className="lv-num">{idx + 1}</span>
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="lvl-name">{cur.name}</div>
            <div className="lvl-sub">{name} · {formatCurrency(lifetimeEarned)} paid out · {completed} campaign{completed === 1 ? '' : 's'} completed</div>
            <div className="lvl-xpbar"><span style={{ width: `${pct}%` }} /></div>
            <div className="lvl-xp-meta">
              <span>{formatCurrency(lifetimeEarned)}</span>
              <span>{next ? `${formatCurrency(next.min)} to reach ${next.name}` : 'Top tier reached'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="sec-head"><h3>The ladder</h3></div>
        <div className="lvl-track">
          {TIERS.map((t, i) => (
            <div key={t.name} className={`lvl-node${i < idx ? ' done' : ''}${i === idx ? ' now' : ''}`}>
              <div className="lvl-dot">{i + 1}</div>
              <div className="lvl-cap">{t.name}</div>
              <div className="lvl-xpc">{t.min === 0 ? 'Start' : formatCurrency(t.min)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="sec-head"><h3>Perks</h3></div>
        {TIERS.map((t, i) => (
          <div key={t.name} className={`perk${i > idx ? ' locked' : ''}`}>
            <span className="perk-ic" style={{ background: grad(t.name) }}><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{i > idx ? <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></> : <path d="m5 12 4 4L19 7" />}</svg></span>
            <div><div className="perk-t">{t.name} tier</div><div className="perk-s">{i <= idx ? 'Unlocked' : `Unlocks at ${formatCurrency(t.min)} paid out`}</div></div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── Saved ───────────────────────── */
export function CreatorSavedPage() {
  return (
    <section className="view active reveal" data-view="saved">
      <div className="page-head">
        <div>
          <h1 className="page-title">Saved</h1>
          <p className="page-sub">Bookmark campaigns you want to come back to. Saved campaigns will live here.</p>
        </div>
      </div>
      <EmptyCard title="Nothing saved yet" sub="Browse the marketplace and tap save on any campaign that catches your eye to keep it here." cta="Browse campaigns" to="/creator/browse" />
    </section>
  );
}

/* ───────────────────────── shared bits ───────────────────────── */
function EmptyCard({ title, sub, cta, to }: { title: string; sub: string; cta: string; to: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '54px 24px' }}>
      <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.02em' }}>{title}</div>
      <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8, maxWidth: 420, marginInline: 'auto' }}>{sub}</div>
      <Link to={to} className="btn-apply" style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', marginTop: 20 }}>{cta} <Arrow /></Link>
    </div>
  );
}
